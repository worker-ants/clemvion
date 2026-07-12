# 신규 식별자 충돌 검토 — spec/5-system/12-webhook.md (impl-done)

## 검토 범위 확인

- diff(`origin/main...HEAD`)는 `codebase/backend/src/modules/hooks/hooks.controller.ts` /
  `hooks.controller.spec.ts` 2개 파일만 변경한다. `spec/5-system/12-webhook.md` 자체는 이번
  변경에 포함되지 않았다 ("구현 대상 spec 영역" 원문도 `(없음)`).
- 연결된 plan(`plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md`)의
  `spec_impact: none` 과 일치 — behavior-preserving 순수 DRY 리팩터(Swagger 문서 문자열이
  실제 헤더와 공유하는 값을 상수로 단일화)이며 신규 요구사항·엔티티·API·이벤트·ENV 도입이
  없다.
- diff 가 새로 도입하는 식별자는 `hooks.controller.ts` 파일 스코프의 **local `const` 2개**뿐:
  - `EMBED_CONFIG_CACHE_CONTROL` (`` `public, max-age=${EMBED_CONFIG_CACHE_SEC}` ``)
  - `EMBED_CONFIG_CACHE_MAX_MINUTES` (`Math.ceil(EMBED_CONFIG_CACHE_SEC / 60)`)
  - export 되지 않으며 다른 모듈에서 import 하지 않는다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 신규 ID 없음 (spec 본문 미변경).
2. **엔티티/타입명 충돌** — 신규 엔티티/DTO/interface 없음. 두 신규 식별자는 `const` 값이며
   타입/클래스가 아니다.
3. **API endpoint 충돌** — 신규/변경 endpoint 없음. 기존 `GET /api/hooks/:endpointPath/embed-config`
   가 그대로이며, method+path 변경 없음.
4. **이벤트/메시지명 충돌** — webhook/queue/SSE 이벤트 이름 변경·추가 없음.
5. **환경변수·설정키 충돌** — 없음. `EMBED_CONFIG_CACHE_SEC`(기존, 값 불변) 을 소스로 하는
   순수 코드 상수 파생이며 ENV/config key 아님.
6. **파일 경로 충돌** — 신규 spec 파일 없음 (target 자체가 spec 비수정). 신규 plan 파일
   `plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md` 는 기존
   `plan/complete/embed-config-dto-rename.md` 와 이름이 달라 충돌 없음.

## 실측 검증

`git grep`으로 신규 식별자가 diff 대상 파일 외 다른 곳(코드/스펙)에 이미 다른 의미로
쓰이고 있는지 확인 — 0건, 모두 diff 대상 두 파일 내부에서만 정의·참조된다.

```
$ grep -rn "EMBED_CONFIG_CACHE" --include="*.ts" codebase/
codebase/backend/src/modules/hooks/hooks.controller.ts:40:const EMBED_CONFIG_CACHE_SEC = 300;         (기존, 값 불변)
codebase/backend/src/modules/hooks/hooks.controller.ts:42:const EMBED_CONFIG_CACHE_CONTROL = ...       (신규)
codebase/backend/src/modules/hooks/hooks.controller.ts:44:const EMBED_CONFIG_CACHE_MAX_MINUTES = ...   (신규)
... (이하 모두 같은 파일 내 참조)
$ grep -rln "EMBED_CONFIG_CACHE" spec/
(0건)
```

부가 확인: plan 문서가 `_MIN` 대신 `_MINUTES` 를 채택한 근거("`_MIN` 은 코드베이스에서
minimum 의미")도 grep 으로 재검증 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
의 `PARALLEL_BRANCH_COUNT_MIN` / `PARALLEL_MAX_CONCURRENCY_MIN` 이 실제로 `_MIN` = "minimum"
관례로 쓰이고 있어, `EMBED_CONFIG_CACHE_MAX_MIN` 이었다면 "max-min"(모순어)으로 읽혀 WARNING
감이었을 것 — 이미 회피된 상태를 확인함(발견사항 아님, 검증 결과).

## 발견사항

없음.

## 요약

target 은 `spec/5-system/12-webhook.md` 를 직접 수정하지 않는 behavior-preserving 코드
리팩터(Swagger 문서 문자열·실제 응답 헤더가 공유하는 Cache-Control 값을 단일 상수로
파생)이며, 새로 도입하는 식별자는 `hooks.controller.ts` 파일 스코프의 로컬 const 2개
(`EMBED_CONFIG_CACHE_CONTROL`, `EMBED_CONFIG_CACHE_MAX_MINUTES`) 뿐이다. 두 식별자 모두
export 되지 않고 코드베이스·spec 전역에서 다른 의미로 쓰인 이력이 없음을 grep 으로
확인했다. 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 중
어느 범주에서도 신규 도입이 없어 충돌 표면 자체가 발생하지 않는다.

## 위험도

NONE
