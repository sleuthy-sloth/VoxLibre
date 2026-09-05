import 'server-only';
import { prisma } from '@/lib/prisma';
import { createAuthenticationOptions, createRegistrationOptions, isRegistrationAllowed } from './webauthn';
import { NextResponse } from 'next/server';

export const CHALLENGE_COOKIE = 'verbalibera_challenge';
const noStore = { 'Cache-Control': 'no-store' };

export async function challengeOptions(request: Request, purpose: 'register' | 'login') {
  if (purpose === 'register' && !isRegistrationAllowed(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401, headers: noStore });
  }
  const accountIdentifier = new URL(request.url).searchParams.get('account')?.trim() ?? '';
  if (purpose === 'register' && (!accountIdentifier || accountIdentifier.length > 100)) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: noStore });
  }
  if (purpose === 'register' && await prisma.user.findUnique({ where: { accountIdentifier } })) {
    return NextResponse.json({ status: 'account_exists' }, { status: 409, headers: noStore });
  }
  const id = crypto.randomUUID();
  const options = purpose === 'register'
    ? await createRegistrationOptions({ userId: id, userName: accountIdentifier, userDisplayName: accountIdentifier })
    : await createAuthenticationOptions({ userVerification: 'required' });
  await prisma.authChallenge.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.authChallenge.create({ data: { id, challenge: options.challenge, purpose, accountIdentifier: purpose === 'register' ? accountIdentifier : null, expiresAt: new Date(Date.now() + 300000) } });
  const response = NextResponse.json(options, { headers: noStore });
  response.cookies.set(CHALLENGE_COOKIE, id, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300 });
  return response;
}

export async function consumeChallenge(request: Request, purpose: 'register' | 'login') {
  const record = await readChallenge(request, purpose);
  if (!record) return null;
  return await consumeChallengeById(record.id, purpose, record.expiresAt) ? record : null;
}

/** Read the current challenge without consuming it. Verification can fail for
 * reasons unrelated to the challenge (for example an alternate hostname), so
 * callers should only consume it after the WebAuthn response verifies. */
export async function readChallenge(request: Request, purpose: 'register' | 'login') {
  const cookie = request.headers.get('cookie')?.split(';').find(value => value.trim().startsWith(`${CHALLENGE_COOKIE}=`));
  if (!cookie) return null;
  const id = cookie.trim().slice(CHALLENGE_COOKIE.length + 1);
  const record = await prisma.authChallenge.findUnique({ where: { id } });
  if (!record || record.purpose !== purpose || record.expiresAt <= new Date()) return null;
  return record;
}

export async function consumeChallengeById(id: string, purpose: 'register' | 'login', expiresAt: Date) {
  const consumed = await prisma.authChallenge.deleteMany({
    where: { id, purpose, expiresAt: { equals: expiresAt, gt: new Date() } },
  });
  return consumed.count === 1;
}
