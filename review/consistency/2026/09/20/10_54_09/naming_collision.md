# 신규 식별자 충돌 검토 — SSRF catch 판정 분기 (impl-done)

## 검토 범위 확인

- spec scope(`spec/4-nodes/4-integration/`) 델타: **0개 파일** — 이 브랜치는 해당 spec 영역을 변경하지 않았다. spec 상 신규 요구사항 ID·엔티티·endpoint·이벤트·env var·파일 경로는 애초에 도입되지 않았다.
- 구현 diff: 10개 파일(HEAD 워킹트리 `git diff origin/main...HEAD -- codebase/` 로 직접 확인) — 전부 기존 SSRF 가드(`http-safety.ts` 의 `SsrfBlockedError`)의 "판정" 과 "가드 자체의 고장(비-`SsrfBlockedError` throw)" 을 구분해 후자를 오분류하지 않도록 하는 방어 로직 추가이며, 새 spec 문서·새 엔티티·새 endpoint 는 없다.

아래는 diff 에 등장하는 식별자 각각을 "신규 도입" vs "기존 재사용" 으로 분류해 충돌 여부를 판정한 결과다.

## 발견사항

없음 (신규 식별자 자체가 도입되지 않아 6개 관점 중 해당하는 항목이 없음).

### 참고 — 검토했으나 충돌 아님으로 판정한 항목

- **`SsrfBlockedError`** (관점 2: 엔티티/타입명): 이번 diff 는 이 클래스를 **소비**(import 후 `instanceof` 분기)할 뿐, 새로 정의하지 않는다. 정의는 `codebase/backend/src/nodes/integration/http-request/http-safety.ts:47` 에 이미 존재하며, `git log --oneline -- codebase/backend/src/nodes/integration/http-request/http-safety.ts` 확인 결과 `ea27c21b3`(이미 `origin/main` 에 병합됨) 커밋에서 도입됐다. `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.spec.ts:64` 에 동일 이름의 **inline mock 클래스**(`jest.mock` 팩토리 내부 로컬 선언)가 있으나, 이는 이번 diff 대상이 아니고(기존 코드) 모듈 스코프가 분리돼 런타임 충돌도 없다.
- **`DB_CONNECT_FAILED` / `HTTP_CONNECT_FAILED`** (관점 1 유사 — 코드/식별자 재의미 부여): `database-connection-tester.ts` · `http-connection-tester.ts` 가 "가드 판정 아닌 오류"의 fallback 코드로 이 상수들을 쓰기 시작했다. 두 상수는 `codebase/backend/src/modules/integrations/connection-test-codes.ts`(선행 커밋 `22727e287`, 이미 main) 에 이미 정의돼 있고, `spec/2-navigation/4-integration.md:483,504,1116,1122` 가 "그 밖(네트워크·타임아웃·TLS 등) 실패" 캐치올로 이미 정의해 뒀다. 이번 diff 는 그 기존 캐치올 버킷에 "가드 자체 고장"이라는 새 원인을 추가로 편입시킨 것 — **동일 식별자를 다른 의미로 재정의**한 것이 아니라 기존에 이미 열려 있던 "기타 실패" 의미 범위 안에 들어간다. (다만 spec 본문이 "가드 고장"을 명시적으로 열거하지는 않는다 — 이는 naming-collision 이 아니라 spec-본문 서술 정합성 문제이므로 `cross_spec`/`rationale_continuity` 관점 소관으로 넘긴다.)
- **`INTEGRATION_CALL_FAILED`** (관점 1 유사): `http-request.handler.ts` · `database-query.handler.ts` 가 SSRF 가드의 비-판정 오류를 이 코드로 승격한다. 이 코드는 `spec/4-nodes/4-integration/0-common.md` §4.2 공통 에러 코드 표에 "기타 일반 예외(분류되지 않은 실패)" 로 이미 정의돼 있어, 새 의미 부여가 아니라 기존 정의된 캐치올을 그대로 적용한 것이다.
- **`sanitizeMessage`** (관점 2): `database-connection-tester.ts` 가 새로 import 하지만, 정의는 `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:165` 에 이미 존재(선행 커밋 `dbdf7de98`, 이미 main)한다. 신규 정의 아님.
- **새 파일**: `codebase/backend/src/nodes/integration/http-request/http-redirect.spec.ts` (신규) — 기존 컨벤션(`*.ts` 옆 `*.spec.ts`)을 그대로 따르는 테스트 파일이며 대상 소스 `http-redirect.ts` 와 동일 디렉터리에 위치. 기존 파일과 경로 충돌 없음.
- **plan 파일**: `plan/in-progress/ssrf-catch-instanceof.md` (신규) — `plan/in-progress/` 내 동명·유사명 기존 파일 없음(`ls` 확인). 명명 컨벤션(kebab-case, 작업명 요약) 준수.
- **환경변수**: 이번 diff 는 새 ENV var/config key 를 도입하지 않는다. spec 이 언급하는 `ALLOW_PRIVATE_HOST_TARGETS` 는 기존 플래그이며 코드 diff 에도 등장하지 않는다(가드 판정 로직 자체는 불변, 판정 이후 예외 처리 경로만 변경).
- **API endpoint / 이벤트·메시지명**: 이번 diff 는 REST endpoint·webhook·queue·SSE 이벤트를 추가하지 않는다. `logger.warn` 로그 문구(`SSRF guard failed (http-request)` 등)는 사람이 읽는 서버 로그 텍스트일 뿐 시스템 식별자가 아니다.

## 요약

target 문서(spec 델타 0)와 구현 diff(10개 파일) 모두 새 요구사항 ID·엔티티/타입·API endpoint·이벤트명·환경변수·설정키·spec 파일 경로를 도입하지 않는다. 유일하게 "새로 쓰이기 시작한" 식별자들(`SsrfBlockedError`, `DB_CONNECT_FAILED`, `HTTP_CONNECT_FAILED`, `INTEGRATION_CALL_FAILED`, `sanitizeMessage`)은 전부 이 브랜치 이전에 이미 정의·문서화된 기존 식별자를 기존 의미(판정 클래스, "기타 실패" 캐치올, "분류되지 않은 실패" 캐치올)대로 새 호출 지점에서 재사용한 것이며, 다른 의미로 재정의하거나 기존 사용처와 충돌하는 사례는 없었다. 새 파일(`http-redirect.spec.ts`, `plan/in-progress/ssrf-catch-instanceof.md`)도 기존 명명 컨벤션을 따르고 기존 파일과 겹치지 않는다.

## 위험도

NONE
