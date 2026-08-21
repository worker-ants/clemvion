# @workflow/masked-markers

egress 마스킹이 남기는 **마커 집합의 단일 진실**과, 마스커가 서브트리를 치환하는 **깊이 상한**.

```ts
import { isMaskedMarker, MASKED_MARKERS, MAX_MASK_DEPTH } from "@workflow/masked-markers";
```

| export | 값 | 뜻 |
| --- | --- | --- |
| `VALUE_MASK_MARKER` | `'***'` | 값-패턴 마스커가 남긴다 |
| `KEY_MASK_MARKER` | `'[REDACTED]'` | 키-이름 마스커(WS payload · webhook ingestion)가 남긴다 |
| `DEPTH_MASK_MARKER` | `'[REDACTED_DEPTH]'` | 깊이 상한을 넘은 서브트리 |
| `MASKED_MARKERS` | 위 셋 (동결 배열) | 집합 |
| `isMaskedMarker(v)` | — | **정확 일치**만 판정 |
| `MAX_MASK_DEPTH` | `10` | 마스커가 치환하는 깊이 = 스캐너가 닿아야 하는 깊이 |

## 왜 패키지인가

이 값들은 **backend 가 만들고 frontend 가 판정한다.** backend 마스커가 자격증명 값을 마커로
치환하고, frontend 는 그 마커를 알아보아 이미 가려진 값을 폼에 프리필하거나 재제출하지
않는다. 양쪽이 같은 집합을 봐야 그 보장이 성립한다.

원래는 두 스택에 손으로 복제돼 있었다. 미러를 기계가 대조하게 만들려 했더니 **CI 경로
게이팅**에 막혔다 — `frontend-checks` 는 `codebase/backend/**` 변경 때 검사를 생략하고
`backend-checks` 는 `codebase/frontend/**` 때 생략한다. 한쪽에 둔 계약 가드는 반대쪽이 마커를
바꾸는 방향에 무력하다. 두 워크플로 모두 `codebase/packages/**` 는 relevant 로 잡으므로,
여기 두면 그 갭이 사라지고 애초에 대조할 미러가 없어진다.

선례: [`@workflow/ai-end-reason`](../ai-end-reason) — 같은 형태의 값 도메인.

## ⚠️ 리터럴이 같다고 같은 계약은 아니다

저장소에는 `'***'` · `'[REDACTED]'` 를 **독립적으로** 쓰는 마스커가 여럿 있다 — HTTP 노드의
쿼리 파라미터 가림, 응답 헤더 가림(`sanitize-response-headers.util.ts`), 이메일 로컬파트
가림(`error-codes.ts`) 등. spec 은 그중 일부의 **합성을 명시적으로 금지**한다.

이 패키지를 import 하지 않는 리터럴을 발견해도 자동으로 결함이 아니다. 판단 기준은
*"프런트의 마커 판정과 같은 계약인가"* 다. 그래서 미러 소멸 가드도 리터럴이 아니라
**export 심볼의 재선언**을 본다.

## 이 패키지를 바꾼다면

마커를 **추가**하면 프런트 가드가 그 신규 마커에 대해서도 자동으로 동작한다 — 그게 추출의
목적이다. 다만 backend 마스커가 그것을 실제로 **생산**하도록 배선하는 것은 별개 작업이다.

`MAX_MASK_DEPTH` 를 바꾸면 마스커와 스캐너가 함께 움직인다. WS 마스커의
`MAX_SANITIZE_DEPTH` 는 **이것이 아니다**(비교가 `depth > N` 이라 한 칸 깊고, 프런트 스캐너는
WS 페이로드를 스캔하지 않는다) — 별개 불변식이므로 함께 바꾸지 말 것.
