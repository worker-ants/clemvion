# 신규 식별자 충돌 검토 — EIA idempotency 캐시 손상 방어 강화

## 검토 범위 요약

diff-base `origin/main` 대비 실제 변경분은 **두 파일뿐**이다 (target spec 영역 `spec/data-flow/`
자체는 이번 diff 에 포함되지 않음 — 컨텍스트 번들로만 제공됨):

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (구현)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (테스트)

두 파일 모두 **기존 파일의 수정**이며 신규 파일 생성이 아니다 (`index <old>..<new>`, `/dev/null` 없음).
`spec/5-system/14-external-interaction-api.md`(Spec EIA, 요구사항 ID `§R7`/`§R8`/`§R10` 등의 SoT)나
`spec/data-flow/15-external-interaction.md` 자체는 이번 diff 에 포함되지 않았고, 코드 docstring 이
기존 `Spec EIA §R8`(캐시 대상 닫힌 목록) 요구사항을 그대로 참조할 뿐 새 요구사항 ID 를 부여하지
않는다.

## 신규 도입 식별자 인벤토리

diff 에서 새로 도입된 식별자는 전부 `idempotency.interceptor.ts` 내부 **module-private** 스코프다:

| 식별자 | 종류 | 스코프 |
| --- | --- | --- |
| `MIN_HTTP_STATUS_CODE` / `MAX_HTTP_STATUS_CODE` | 파일 top-level `const` | 파일 내부 전용(미export) |
| `isIdempotencyEntry()` | 파일 top-level 함수 (type guard) | 파일 내부 전용(미export) |
| `isHttpStatusCode()` | 파일 top-level 함수 (type guard) | 파일 내부 전용(미export) |
| `describeShape()` | 파일 top-level 함수 | 파일 내부 전용(미export) |
| `discardCorruptEntry()` | `IdempotencyInterceptor` private 메서드 | 클래스 내부 전용 |
| 로그 메시지 문자열 `cache 엔트리 손상` / `cache payload 손상` | 로그 prefix (이벤트명 아님) | 자유 텍스트, 운영자 grep 용 |

API endpoint·BullMQ 큐/이벤트명·webhook 이벤트명·ENV var·config key·엔티티/DTO·spec 파일 경로 — 어느
범주에도 신규 항목이 없다. `IdempotencyEntry` 인터페이스, `cacheTapped`/`storeEntry` 메서드는 diff
컨텍스트 라인(`+`/`-` 아님)으로만 나타나 기존 정의다.

## 충돌 스캔 결과 (실측)

워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, HEAD)
전체 `codebase/` + `spec/` 에서 위 신규 식별자를 `git grep` 한 결과, 전부 해당 파일(및 그 spec
테스트 파일)에만 등장한다 — 타 모듈·타 spec 문서에서의 재사용/충돌 없음:

```
isHttpStatusCode      → idempotency.interceptor.ts 정의만
isIdempotencyEntry     → idempotency.interceptor.ts 정의만
describeShape          → idempotency.interceptor.ts 정의만
discardCorruptEntry    → idempotency.interceptor.ts 정의만
MIN_HTTP_STATUS_CODE / MAX_HTTP_STATUS_CODE → idempotency.interceptor.ts 정의만
"cache 엔트리 손상" / "cache payload 손상" → idempotency.interceptor.spec.ts 의 단언문에서만 참조(로그 검증)
```

## 관점별 판정

1. **요구사항 ID 충돌** — 신규 ID 부여 없음(§R8 기존 참조 유지). 해당 없음.
2. **엔티티/타입명 충돌** — 신규 인터페이스/DTO 없음. `isIdempotencyEntry`/`isHttpStatusCode` 는
   타입 가드 함수이며 미export·타 파일 미참조. 해당 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음(기존 `/api/external/executions/:id/*` 라우팅 불변).
   해당 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음. 로그 prefix 문자열은
   이벤트 채널이 아니라 운영 로그 텍스트이며 다른 모듈의 로그 문자열과 겹치지 않는다. 해당 없음.
5. **환경변수·설정키 충돌** — `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 는 코드 상수이지
   ENV var 나 config key 가 아니다(주입되지 않음, `process.env` 미참조). 해당 없음.
6. **파일 경로 충돌** — 신규 파일 없음(기존 두 파일 수정만). 해당 없음.

### 발견사항

없음.

## 요약

이번 target 변경은 `spec/data-flow/15-external-interaction.md`/Spec EIA 가 이미 정의한 idempotency
캐시 fail-open 요구사항(§R8) 범위 안에서, 캐시 엔트리 손상(문법 오류를 통과하는 `null`/원시값/배열/
필드 누락·타입 불일치, 그리고 엔트리 안쪽 `responseJson`)을 방어하는 순수 내부 하드닝이다. 새로
도입된 식별자(상수 2개·함수 3개·private 메서드 1개)는 전부 `idempotency.interceptor.ts` 모듈
스코프에 갇혀 있고 export 되지 않으며, 저장소 전역 `git grep` 로 확인한 결과 다른 모듈·spec
문서에서의 동일 이름 재사용이 없다. 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·config
key·spec 파일 경로도 이번 diff 에 전혀 등장하지 않는다. 따라서 신규 식별자 충돌 관점의 위험은
없다.

## 위험도

NONE
