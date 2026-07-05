# 정식 규약 준수 검토 — spec/4-nodes/4-integration

## 검토 범위
- Target: `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,3-send-email,4-cafe24,5-makeshop}.md`
- 대조 규약: `spec/conventions/node-output.md`, `spec/conventions/error-codes.md`, `spec/conventions/chat-channel-adapter.md`, `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/audit-actions.md`
- 검토 모드: impl-done. 단, `git -C <worktree> diff main -- spec/4-nodes/4-integration/` 결과 **0줄** — 이 4개 노드 문서는 현재 브랜치에서 `main` 대비 변경되지 않았다(이미 병합된 상태, 최근 SSRF 일반화는 PR #814 로 반영 완료). 따라서 본 검토는 "신규 diff 검토"가 아니라 **현재 상태의 정식 규약 준수 스냅샷**으로 수행했다.

## 발견사항

- **[INFO]** `EMAIL_HOST_BLOCKED` 의 chat-channel 분류표 부재는 이미 문서화된 의도적 결정 — 재조사 불요
  - target 위치: `3-send-email.md` §6, §8.0
  - 위반 규약: (오탐 방지 기록) `spec/conventions/chat-channel-adapter.md` §3.1 분류표
  - 상세: 처음에는 `HTTP_BLOCKED`/`DB_HOST_BLOCKED` 가 분류표에 명시 등재된 반면 `EMAIL_HOST_BLOCKED` 는 누락되어 비대칭처럼 보였으나, `spec/2-navigation/4-integration.md:1136` (`EMAIL_HOST_BLOCKED` Rationale)이 "node-level `output.error.code`/연결테스트 `result.code` 로만 surface, 워크플로 실패로 격상 시 execution 레벨은 이미 등재된 `ERROR_PORT_FALLBACK` 로 수렴하므로 분류표 행 추가 불필요"라고 명시적으로 검토·기각한 상태다. target 문서(`3-send-email.md`)도 이 SoT 를 링크로 인용한다.
  - 제안: 조치 불요. (참고로 `CAFE24_*` 계열 코드 전체도 동일 분류표에 미등재이나, 이는 이번 변경과 무관한 기존 상태이며 동일하게 fallback(`executionFailedInternal`+warn) 으로 안전 수렴한다.)

- **[INFO]** 캔버스 요약 40자 vs 개별 노드 문서의 "35자" 잔존 표기
  - target 위치: `1-http-request.md` §7 "캔버스 요약" (`URL 35자 초과 시 잘림` 문구)
  - 위반 규약: `0-common.md` §5 (공통 캔버스 요약 규약 — "라인 전체를 **40자** 한도로 자른다"로 SoT 단일화, HTTP Request 행도 "라인 40자 초과 시 잘림"으로 표기)
  - 상세: `0-common.md` §5 표는 HTTP Request 잘림 한도를 40자로 통일해 명시하는데, `1-http-request.md` §7 은 옛 "URL 35자" 문구를 그대로 남겨 SoT(0-common §5)와 하위 문서 간 숫자가 불일치한다. 사용자에게 실질적 혼란을 주는 정도는 아니나(§7 은 §5 를 "인용"한다고 밝히면서 실제로는 다른 숫자를 적음), 규약 문서 내부 self-consistency 관점에서 사소한 drift다.
  - 제안: `1-http-request.md` §7 의 "35자"를 `0-common.md` §5 와 동일하게 "40자"로 정정하거나, 의도적으로 다른 한도라면 그 근거를 명시.

- **[INFO]** `1-http-request.md` §5.3.2 의 `output.response.error` Deprecated 필드가 Principle 11 "undefined 생략" 원칙과 별도 예외로 존치
  - target 위치: `1-http-request.md` §5.3.2 필드 표
  - 위반 규약: `spec/conventions/node-output.md` Principle 8.1 (이중/불필요 중첩 금지) 취지와 결이 다름 — 직접 위반은 아님
  - 상세: 문서 스스로 "Deprecated (legacy 호환 잔재) — 신규 코드는 `output.error.{code,message}` 를 SoT 로 사용하고 본 필드에 의존하지 말 것"이라고 명시해 두어 규약 위반이라기보다는 **알려진 legacy 필드의 정직한 문서화**다. 다만 `error-codes.md` §3(Historical-artifact 예외 레지스트리)과 같은 명시적 "예외 등록부"에는 아직 등재되어 있지 않다.
  - 제안: 조치 불요(현행 문서화로 충분). 필요 시 `error-codes.md` §3 부류의 legacy-field 레지스트리를 신설해 `output.response.error` 도 함께 관리하면 일관성이 더 높아짐 — 정책 갱신 아이디어로만 제시.

## 요약

`spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,3-send-email}.md` 는 `node-output.md` 의 5필드 invariant(§Principle 0), config/output 직교성(§1.1), 에러 컨트랙트(§3, D4 Runtime 라우팅), config echo 명시열거(§7 D1), 캔버스 요약 규약(§11 출력 예시 포맷) 을 모두 정확히 준수한다. 에러 코드 명명은 `error-codes.md` §1(의미기반 명명)·UPPER_SNAKE_CASE 표기·도메인 prefix(`HTTP_*`/`DB_*`/`EMAIL_*`/`INTEGRATION_*`/`CAFE24_*`) 규칙을 전부 지키며, `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 3-노드 SSRF 코드 대칭·chat-channel 분류표 영향 분석까지 cross-doc 으로 정합하게 연결되어 있다(`2-navigation/4-integration.md` Rationale 참조). CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다 — 유일하게 눈에 띈 것은 `1-http-request.md` §7 의 "35자" 잔존 표기가 §5(SoT) 의 "40자"와 어긋나는 사소한 self-consistency drift(INFO)뿐이다. 문서 구조(번호 섹션 + 말미 Rationale)도 인접 노드 문서군과 동일한 기존 패턴을 유지해 이질감이 없다.

## 위험도
LOW
