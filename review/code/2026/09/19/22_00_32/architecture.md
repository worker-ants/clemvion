# 아키텍처 리뷰 — SMTP SSRF 가드 통합 2라운드 (`SsrfBlockedError` 도입 후)

이 라운드는 1라운드 리뷰(`review/code/2026/09/19/21_38_32/`)의 WARNING 조치 결과(`a1e1a591b`: 메시지 접두어 매칭 → `SsrfBlockedError` 클래스, 헤더 주석 보강, CHANGELOG·`.env.example` 갱신)를 다시 검토한다.

## 1라운드 WARNING 확인 결과

- **[해소 확인]** W1(판정을 메시지 접두어로 가름) — `http-safety.ts` 에 `SsrfBlockedError` 클래스를 export 하고, `smtp-host-guard.ts` 는 `instanceof SsrfBlockedError` 로 판정한다. 타입 안전한 판별로 전환됐다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:47`~`52`(`export class SsrfBlockedError`), `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:20`~`31`(`isSmtpHostBlocked`)
- **[부분 해소]** W2(공용 가드가 `http-request/` 폴더에 상주) — 헤더에 이유 한 줄을 남기고 이전은 트래커로 미룬 것은 맞다. 다만 아래 새 발견사항 1에서 그 트래커 참조 자체의 정확성 문제를 짚는다.

## 발견사항

- **[WARNING]** 새로 도입한 `SsrfBlockedError` 판별 계약이 5개 소비자 중 1곳(`smtp-host-guard.ts`)에만 적용됐다 — 나머지 4곳은 여전히 "무슨 예외든 SSRF 차단으로 승격"하는 blanket catch 다.
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:24`~`29`(`try { await assertSafeOutboundHostResolved(trimmed); } catch (err) { if (err instanceof SsrfBlockedError) return true; throw err; }`) — 이번 diff 로 새로 생긴 유일한 타입 기반 판별 지점. 이와 대비되는 기존(diff 밖) 소비자: `http-request.handler.ts`(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` preflight try/catch, `catch (err) { ... }` 뒤 무조건 `HTTP_BLOCKED` 로 변환), `database-connection-tester.ts`(`testDatabaseConnection` 의 `catch (err) { ... DB_HOST_BLOCKED }`), `database-query.handler.ts`(SSRF 가드 호출부 `catch { throw new IntegrationError('DB_HOST_BLOCKED', ...) }`), `http-redirect.ts`(`outboundBlockReason` — `catch (err) { return err instanceof Error ? err.message : String(err); }`, 즉 모든 예외를 "차단 사유"로 되돌림).
  - 상세: `http-safety.ts` 의 새 JSDoc(게이트 44~45)은 "판정인지 다른 오류인지는 메시지 접두어가 아니라 이 클래스로 가른다" 고 명시적으로 계약을 선언한다. 그런데 실제로 `instanceof SsrfBlockedError` 로 그 계약을 검증하는 곳은 이번에 새로 짠 `smtp-host-guard.ts` 하나뿐이다. 나머지 네 소비자는 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 가 던지는 것이면 무엇이든 SSRF 차단(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`)으로 승격한다. 현재는 두 함수가 `SsrfBlockedError` 외에는 아무것도 던지지 않아(동작 회귀는 없음) 무해하지만, 이 클래스를 도입한 동기 자체가 "판정과 다른 오류를 컴파일 타임에 안전하게 구분" 하는 것이었는데, 그 이점이 5개 소비자 중 1개에만 적용된 상태다. 향후 두 함수에 새 실패 경로(예: 추가 검증, 리팩터링 중 실수)가 생기면, 이 4곳은 그 버그를 "정상적인 보안 차단"으로 조용히 오분류해 사용자에게 `HTTP_BLOCKED`/`DB_HOST_BLOCKED` 로 보여준다 — 정확히 이번 PR 이 `smtp-host-guard.ts` 하나에서 고친 그 실패 모드가, 나머지 소비자에서는 여전히 열려 있다.
  - 제안: `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 의 공개 계약을 "이 함수들은 `SsrfBlockedError` 외에는 던지지 않는다" 로 명문화했다면, 최소한 4개 기존 소비자의 catch 블록도 같은 패턴(`instanceof SsrfBlockedError` 아니면 rethrow)으로 맞추는 후속 작업을 트래커에 등재하는 편이 좋다. 지금 상태로는 새 클래스가 "설계 의도"로만 존재하고 코드베이스 전체에 강제되지 않는다.

- **[WARNING]** `http-safety.ts` 헤더 주석이 "폴더 위치 이전은 트래커에 따로 있다"고 현재형으로 단언하지만, 그 트래커 파일에는 해당 항목이 없다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:11`~`13`(`* 공용인데 \`http-request/\` 폴더에 있는 이유: … 중립 위치로 옮기는 것은 그 spec 경로와 함께 바꿔야 해서 트래커에 따로 있다(\`plan/in-progress/spec-draft-nullable-notation-followups.md\`).`)
  - 상세: `grep -n "http-safety" plan/in-progress/spec-draft-nullable-notation-followups.md` 결과 매치는 1건뿐이고, 그 문장은 "SMTP 가드가 HTTP 가드와 다른 구현이었다"는 이번 작업의 배경 서술이지 폴더 이전 항목이 아니다(폴더 이전·`code:` frontmatter 동반 변경을 다루는 체크리스트 항목은 그 파일 어디에도 없다). `review/code/2026/09/19/21_38_32/RESOLUTION.md` 의 W2 처분도 "트래커 등재(마무리 커밋)"이라고 적어 실제 등재는 **이 plan 의 마무리 커밋 시점**으로 미뤄 둔 상태이고, `plan/in-progress/ssrf-guard-integration-unify.md` 의 체크리스트 마지막 항목("트래커 두 항목 해소 + `ssrf.util` 항목 등재 · 이 plan `plan/complete/` 로")도 아직 `[ ]`(미완료)다. 즉 코드 주석은 "지금 트래커에 있다"고 현재형으로 말하지만 실측 결과 아직 없다 — 이 세션이 마무리 커밋 전에 끝나면, 폴더-소유권 트레이드오프를 되짚을 유일한 단서(주석)가 존재하지 않는 트래커 파일을 가리키는 채로 남는다.
  - 제안: 주석을 "마무리 커밋에서 트래커에 등재 예정"처럼 시제를 정정하거나, 이번 PR 의 마무리 커밋에서 실제로 `spec-draft-nullable-notation-followups.md`(또는 별도 트래커)에 이 항목을 등재해 주석과 실측을 맞춘다.

## 순환 의존성 확인

- `nodes/integration/send-email/smtp-host-guard.ts → nodes/integration/http-request/http-safety.ts` 방향의 신규 의존을 추가로 확인했다. `grep -rn "send-email" codebase/backend/src/nodes/integration/http-request/` 결과 `http-request/` 쪽에서 `send-email`/`database-query` 로 향하는 역참조는 없다 — 순환 없음. `database-query.handler.ts` 가 이미 같은 폴더의 `http-safety.ts` 를 쓰던 선례가 있어(1라운드에 이미 지적된 패턴), 이번 변경이 새로 만든 결합 방향이 아니라 기존 패턴의 반복이다.

## 요약

`SsrfBlockedError` 도입으로 1라운드에서 지적된 "메시지 문자열 접두어 매칭" 문제 자체는 해소됐다. 다만 그 해소가 5개 소비자 중 1곳(`smtp-host-guard.ts`)에만 미쳐, 나머지 기존 소비자(HTTP 노드 preflight·리다이렉트, DB 연결 테스트·실행)는 여전히 "무슨 예외든 차단"으로 뭉뚱그리는 더 약한 패턴을 쓴다 — 지금은 두 안전 함수가 그 클래스 외엔 아무것도 던지지 않아 행동 회귀는 없지만, 새로 세운 타입 계약이 코드베이스 전체에 강제되지 않는 불일치다. 또한 폴더 위치 이전을 미룬 근거로 인용한 트래커 파일에는 실제로 해당 항목이 없어(등재는 이 plan 마무리 커밋으로 예정), 주석의 현재형 단언이 실측과 어긋난다. 두 건 모두 병합을 막을 결함은 아니고, 순환 의존·레이어 붕괴·SOLID 위반 같은 구조적 결함도 새로 발견되지 않았다.

## 위험도

LOW
