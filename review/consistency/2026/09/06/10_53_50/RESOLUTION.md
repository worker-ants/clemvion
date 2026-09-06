# RESOLUTION — `review/consistency/2026/09/06/10_53_50`

**원 결과**: BLOCK: NO · Critical 0 · WARNING 2 · 위험도 MEDIUM

두 WARNING 모두 **이미 등재된 planner 항목의 재확인**이다 — checker 자신이
*"신규 항목 생성 불필요, 우선 처리만 권고"* 라고 적었다. `spec/` 쓰기는 developer 권한 밖이라
이 브랜치에서 집행하지 않는다.

## WARNING 1 — 신규 검증자 2축이 §5.4 「검증 층」·`code:` 미등재

직전 라운드에 등재했고, 이번 라운드가 3개 checker 로 재확인했다. **등재만 하고 끝내지 않고
지시를 더 정확히 고쳤다**:

spec 본문에 *"**두 검증자**"* 라고 **개수를 못 박은 문장이 둘** 있다:

| 파일 | 문장 |
|---|---|
| `spec/5-system/2-api-convention.md` §5.4 검증 층 | *"그 자리를 **두 검증자**가 나눠 맡는다"* |
| `spec/conventions/swagger.md` §5-1 | *"**두 검증자**의 경계는 … 이 소유한다"* |

축이 늘었으므로 그 표현이 이제 거짓이다. 항목에 대상 문장을 표로 명시하고, **새 개수를 적어
넣지 말고 나열하라**고 못 박았다 — 숫자를 다시 쓰면 다음 축에서 또 낡는다. 이 문서가 이미
두 번 겪은 실패다.

## WARNING 2 — `User` 7컬럼 노출 금지가 spec 규범 문장으로 없다

직전 라운드에 등재. 이번 라운드가 `secret-store.md §1.1` 이 Trigger·AuthConfig 축에만
대칭 규범을 세워 두고 `User` 축이 빠져 있음을 다시 짚었다 — 등재문이 이미 그 대칭을 근거로
적고 있어 내용 변경 없음.

## INFO — 조치 불요

`select:false` 기각 근거의 `## Rationale` 이관(WARNING 2 와 같은 턴), `## Overview` 표기
불일치, `spec/5-system` vs `spec/conventions` 배치, 검증자 명명 인접성, fixture 명명 —
전부 비차단이거나 이번 diff 가 만든 드리프트가 아니다.

**INFO#6(e2e 레터 `J.` 물리 순서)는 고쳤다** — 코드 리뷰 W3 과 같은 건이라 그쪽에서 처리했다.

## 검증

lint PASS · unit PASS · build PASS · e2e PASS **299**.
