# 정식 규약 준수 검토 — 직전 라운드(`16_51_08`) WARNING 2건 처분 검증

대상: `spec/5-system/14-external-interaction-api.md`(§5.1/§5.5/§3.3), `spec/5-system/3-error-handling.md §1.6`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
비교 규약: `spec/conventions/error-codes.md`(명명·안정성·historical-artifact registry), `spec/5-system/3-error-handling.md`(카탈로그 SoT 선언)

## 확인 절차 및 근거

1. **`3-error-handling.md §1.6` 표 직접 diff 확인** (`git diff HEAD~3 -- spec/5-system/3-error-handling.md`) — `TOKEN_REFRESH_NOT_IN_WINDOW`(400)·`TOKEN_REFRESH_FAILED`(400)·`TOKEN_REFRESH_FORBIDDEN`(403) 3행이 실제로 추가됐고, 기존 `EXECUTION_TERMINATED`(410) 행에 "`POST .../refresh-token`(EIA §5.5)에서는 미존재 execution 도 이 코드로 합류한다(`404` 아님)" 캐비엇이 추가됐다. `TOKEN_REVOKED/…` 행의 "모든 토큰류 실패는 단일 401" → "모든 토큰 **검증** 실패는 단일 401"로 좁혀졌고 `403 TOKEN_REFRESH_FORBIDDEN` 이 그 대상이 아니라는 문장도 새로 붙었다. → **처분 1 실제로 됨**.
2. **`§3.3` 오기 정정 확인** — target §5.5 블록(주석 `Guard 선차단, §5.1 표`, 콜아웃 `§5.1 표의 404 EXECUTION_NOT_FOUND 는 다른 엔드포인트 기준`)이 모두 `§5.1`로 정정돼 있음을 직접 읽어 확인. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:80`도 "§5.1 에러 코드 표"로 정정됨. `spec/`·`plan/` 전수 grep(`§3\.3`)으로 남은 것은 전부 (a) target 문서 자신의 §3.3 인증 요구사항 표(EIA-AU-06/08)에 대한 정당한 자기참조, (b) 완전히 무관한 다른 문서(rag-search/execution-engine/websocket-protocol/1-auth 등)의 §3.3 자기참조, (c) `plan/in-progress/spec-sync-external-interaction-api-gaps.md:110`의 "내가 인용한 §3.3 이 틀렸다"라는 처분 이력 서술(오기 자체가 아니라 오기를 설명하는 메타 문장) 뿐 — 에러 표를 가리키는 잘못된 §3.3 인용은 0건. → **처분 2 실제로 됨, 잔존 없음**.
3. **§1.6 표 형식·정렬 관례** — 4컬럼(코드/status/설명/비고) 구조와 "비고" 열의 empty-or-short-note 사용 패턴을 새 3행이 그대로 따른다. status 오름차순 여부는 diff 이전부터 이미 지켜지지 않고 있었다(원표 순서 `400,400,409,409,410,401,429` — `410`이 `401`보다 먼저 나옴). 신규 3행은 방금 §5.5 캐비엇이 붙은 `EXECUTION_TERMINATED`(410) 바로 뒤, `TOKEN_REVOKED` 그룹(401, 일반 토큰 검증) 앞에 삽입돼 "§5.5 전용 코드끼리 인접" 배치가 됐다 — status 오름차순은 아니지만, 이 테이블이 애초에 status-sort 규약을 가진 적이 없고(`spec/conventions/error-codes.md`에도 카탈로그 표의 행 정렬 규칙은 없음), 삽입 위치는 원표의 "주제별 인접 배치" 관행과 부합한다. `spec/conventions/error-codes.md` 전체를 직접 읽었으나 행 정렬·비고 열 사용에 대한 명시 규칙은 없음(§1 명명·§2 안정성·§3 historical-artifact·§4 내부분류·§5 rename 이력만 규정) — 정식 규약 위반 근거 부재.
4. **§1.6 vs SoT(§5.1) 문구 정합** — 10행 전부를 §5.1 표·§5.5 블록과 대조. 좁히거나 넓히는 모순 없음. 오히려 §1.6의 새 문구는 §5.1의 "여기서 '검증 실패'는 `InteractionGuard`가 핸들러 이전에 판정하는 집합" 한정어를 그대로 이식했고, cross-doc 참조에 "EIA §5.5"처럼 `EIA` 접두를 붙여 `3-error-handling.md` 자신의 로컬 §5(클라이언트 에러 처리)/§5.1(API 에러 처리 흐름)과의 혼동을 피했다 — 오히려 SoT(target 문서, `14-...md`)의 bare `§5.5` 표기보다 이 문서 맥락에서는 더 명확하다. `EXECUTION_NOT_FOUND`(404) 행은 §1.6에 없지만 이는 이번 diff와 무관한 기존 설계(표 하단 각주가 "API 규약/§1.2~§1.3 표준 코드 재사용"이라 override 카탈로그 대상이 아니라고 명시) — §5.1의 해당 캐비엇("§5.5는 예외 — 미존재도 410으로 합류")은 §1.6의 `EXECUTION_TERMINATED` 행에서 반대 방향으로 이미 포착돼 있어 누락이 아니다.

## 발견사항

없음. 직전 라운드가 지적한 WARNING 2건 모두 spec 2곳(`14-external-interaction-api.md` §5.1 표+§1.6 카탈로그, 정확히는 3곳 — §5.5 콜아웃 2개소 포함) + plan 1곳에서 실제로 정정됐고, 새로 추가된 내용이 형식·정렬 관례를 어기거나 SoT(§5.1)와 문구 수준에서 어긋나는 지점은 찾지 못했다. `§3.3` 오기의 전수 재발도 없다.

## 요약

`3-error-handling.md §1.6`에 `TOKEN_REFRESH_NOT_IN_WINDOW`/`TOKEN_REFRESH_FAILED`/`TOKEN_REFRESH_FORBIDDEN` 3행이 실제로 추가됐고 `EXECUTION_TERMINATED` 행에도 §5.5 캐비엇이 붙었음을 diff·본문 직독으로 확인했다. `§3.3` → `§5.1` 정정도 target 2개소 + plan 1개소 전부 실제로 반영됐고, `spec/`·`plan/` 전수 grep 결과 에러 표를 잘못 가리키는 §3.3 인용은 더 이상 없다(남은 §3.3은 전부 무관한 다른 절에 대한 정당한 자기참조이거나 처분 이력을 설명하는 메타 서술). §1.6 신규 3행은 이 표의 4컬럼 구조·비고 열 관례를 지키며, status 오름차순은 diff 이전부터 이 표의 규칙이 아니었으므로(원표부터 비정렬) 위반이라 보기 어렵다. 신규 행의 문구는 SoT(§5.1)의 한정어("검증 실패"로 좁힌 범위)를 정확히 이식했고 cross-doc 참조 표기(`EIA §5.5`)도 이 문서 맥락에서 더 명확하다 — 미러가 SoT보다 넓거나 좁게 말하는 지점은 발견하지 못했다.

## 위험도

NONE
BLOCK: NO
STATUS: OK
