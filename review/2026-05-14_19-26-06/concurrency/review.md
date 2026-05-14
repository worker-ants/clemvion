## 발견사항

### [WARNING] catch 블록 내 `await markIntegrationCallbackError` 예외 미처리

- **위치**: `integrations.controller.ts` — catch 블록 (`ctx?.integrationId` 분기)
- **상세**: 현재 흐름은 다음과 같다:
  ```
  catch(err) →
    await markIntegrationCallbackError(...)  ← DB 쓰기
    res.send(renderCallbackHtml(...))        ← 팝업 응답
  ```
  `markIntegrationCallbackError`가 DB 연결 오류나 타임아웃으로 예외를 던지면, 이를 잡는 내부 try-catch가 없으므로 `res.send`에 도달하지 못한다. 결과적으로 Cafe24 팝업 창이 응답을 받지 못하고 hang — 사용자 입장에서는 에러 원인도 볼 수 없고 창도 안 닫힌다.
- **제안**:
  ```typescript
  try {
    await this.oauthService.markIntegrationCallbackError(...);
  } catch (diagErr) {
    this.logger.error('Failed to record callback error', diagErr);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderCallbackHtml(...));
  ```
  진단 기록 실패가 사용자 피드백 전달을 막지 않도록 방어.

---

### [INFO] 동일 `integrationId`에 대한 동시 콜백 실패 — last-writer-wins

- **위치**: `integrations.controller.ts` — `markIntegrationCallbackError` 호출 경로
- **상세**: 두 콜백 요청이 동일 `integrationId`로 거의 동시에 실패하면 두 번의 `markIntegrationCallbackError`가 병렬로 실행된다. DB UPDATE는 원자적이나 어느 쪽의 `{code, message, at}`가 `last_error`에 남는지는 비결정적(last-writer-wins). 진단 데이터가 목적이므로 데이터 손상은 없지만, 관측된 에러가 실제 마지막 실패와 다를 수 있다.
- **제안**: 진단 용도에서 허용 가능한 수준. 다만 `last_error.at` 타임스탬프를 DB 서버 시각(`NOW()`)으로 기록하면 어느 쪽이 나중 쓰기인지 추적 가능해진다.

---

## 요약

변경된 코드 중 동시성 관점에서 실질적 위험이 되는 지점은 `integrations.controller.ts`의 catch 블록이다. 진단 DB 쓰기(`markIntegrationCallbackError`)가 예외를 던질 경우 팝업 응답(`res.send`)이 누락되어 사용자 피드백 채널이 완전히 차단된다. 이 패턴은 `async/await` 오류 전파 특성상 silent hang으로 나타나기 때문에 재현·디버그가 어렵다. 나머지 변경(DTO 필드 추가, 엔티티 포맷팅, 템플릿 렌더링, FE 뱃지 로직)은 동시성과 무관하다.

## 위험도

**MEDIUM**