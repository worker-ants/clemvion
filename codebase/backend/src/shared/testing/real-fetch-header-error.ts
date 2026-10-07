/**
 * 실제 fetch(undici)가 헤더 값 검증에서 던지는 오류를 만들어, 테스트 realm 의 `TypeError` 로
 * 다시 담아 돌려준다.
 *
 * 왜 다시 담나: jest 는 테스트 코드를 별도 realm 에서 돌리고 fetch 는 Node 본래 realm 의 것이라
 * 그 오류는 테스트 쪽 `instanceof Error` 가 거짓이다. 그대로 던지면 클라이언트가
 * `lastError instanceof Error` 분기를 타지 않아 운영과 다른 경로를 검사하게 된다. 그래서 원문
 * (`message`)만 실제 fetch 에서 가져오고 오류 객체는 테스트 realm 에서 만든다.
 *
 * 요청은 닫힌 로컬 포트로 보낸다. 헤더 검증은 연결 전에 실패하므로 네트워크를 쓰지 않는다.
 * 원문에 헤더 값이 실린다는 전제가 깨지면(런타임이 바뀌어 다른 오류가 나면) 던진다. 그 전제
 * 없이 테스트가 통과하면 아무것도 지키지 못한다.
 */
export async function realFetchHeaderError(
  authorizationValue: string,
): Promise<TypeError> {
  let message: string | undefined;
  try {
    await fetch('http://127.0.0.1:9/', {
      method: 'POST',
      headers: { authorization: authorizationValue },
      signal: AbortSignal.timeout(1000),
    });
  } catch (err) {
    message = (err as { message?: unknown }).message as string | undefined;
  }
  if (typeof message !== 'string' || !message.includes(authorizationValue)) {
    throw new Error(
      `전제가 깨졌다: fetch 오류 원문에 헤더 값이 없다 (${JSON.stringify(message)})`,
    );
  }
  return new TypeError(message);
}
