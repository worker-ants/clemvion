# 유지보수성(Maintainability) 리뷰

## 리뷰 대상 요약

- `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` — 유일한 실제 코드(TypeScript) 변경. `MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` 두 상수의 JSDoc 만 수정 ("슬라이딩 윈도우" → "fixed-window" 정정).
- `plan/in-progress/backend-lint-gate-broken-on-main.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/15-chat-channel.md`, `spec/conventions/redis-keys.md` — 전부 문서(spec/plan) 변경으로, 함수 길이·중첩·순환 복잡도 등 코드 유지보수성 기준이 적용되지 않는 영역. 문서 구조·일관성 관점에서만 훑었다.

### 발견사항

없음. 아래는 확인한 항목의 근거만 남긴다(발견사항이 아니라 검토 메모).

- `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts:142-145` (게이트 기준) — 상수 docstring 두 줄이 "슬라이딩 윈도우"에서 "fixed-window"로 정정되었고, 같은 파일의 `incrWithWindow` 메서드 docstring(`:110-121`)이 이미 "`EXPIRE ... NX` 라 window 는 연장되지 않아 fixed-window 유지"라고 명시하고 있어 파일 내부 일관성이 이번 변경으로 오히려 개선됐다(기존엔 상수 docstring과 메서드 docstring이 서로 모순). 함수 구조·네이밍·매직넘버(`60`/`3600`은 이미 named export 상수)·중첩 깊이 모두 변경 없음.
  - 자매 서비스(`ChatChannelRateLimiterService`, `OutboundNotificationRateLimiterService`)는 이미 "fixed-window"로 정확히 표기하고 있어, 이번 정정으로 세 서비스 간 용어 일관성도 확보됐다.
- `spec/4-nodes/4-integration/4-cafe24.md` — §4.4(normative) 신설 + §9.8(Rationale) 안의 중복 규범 서술을 포인터로 축약. 명세 문서의 "본문=명세 SoT / Rationale=설계 근거" 구조 원칙에 맞게 정리되어 문서 가독성·SoT 명확성이 개선됐다. 기존 헤딩은 삭제 없이 추가만 이루어져 앵커 링크 파손 위험도 없다.
- `spec/5-system/15-chat-channel.md` CCH-SE-02 — 요구사항 행에서 구현 세부(Redis 명령·키 포맷 리터럴)를 제거하고 `data-flow/14 §2.2`를 SoT 로 포인팅. 요구사항 표가 "무엇을 요구하는가"만 남기도록 축약되어 이중 SoT 위험이 줄었다.
- `spec/conventions/redis-keys.md` — 인벤토리 표의 앵커 링크만 `§9.8` → `§4.4`로 갱신. 순수 포인터 동기화.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 체크박스 완료 표시 + 완료 근거 서술 추가. 작업 이력 문서로, 코드 유지보수성 판단 대상 아님.

## 요약

이번 변경분의 실질 코드 diff는 `public-webhook-quota.service.ts`의 JSDoc 주석 2줄 수정뿐이며, 함수 구조·네이밍·중첩·매직넘버·중복·복잡도 어느 기준에서도 새로운 리스크를 만들지 않는다. 오히려 상수 docstring과 동일 파일 내 메서드 docstring 간의 기존 모순(슬라이딩 vs fixed-window)을 해소해 파일 내부 일관성이 개선되었고, 형제 서비스들과의 용어 일관성도 확보됐다. 나머지 4개 파일은 모두 spec/plan 문서로, 코드 유지보수성 관점의 점검 항목(함수 길이·중첩·순환 복잡도 등)이 적용되지 않는다. 문서 구조 측면에서도 SoT 재배치가 명확하고 앵커 파손이 없어 문제되는 지점을 찾지 못했다.

## 위험도

NONE
