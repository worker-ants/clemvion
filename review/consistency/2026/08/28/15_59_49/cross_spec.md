### 발견사항

- **[INFO]** 검토 대상 스코프(`spec/5-system/`)와 실제 diff 가 불일치 — spec 문서 자체는 변경 없음
  - target 위치: 프롬프트 "Target 문서" 섹션(`spec/5-system/` 전체) / 검토 모드 `--impl-done scope=spec/5-system/`
  - 충돌 대상: 실제 `git diff origin/main...HEAD -- code_areas` 는 `codebase/backend/package.json`(devDependency 제거) + `expression-resolver.service.spec.ts`·`code.handler.spec.ts` 두 테스트 파일 추가뿐이다. `git diff origin/main --stat -- spec/5-system/` 는 공집합(HEAD 워킹트리에서 직접 실측).
  - 상세: 이번 PR 은 ESLint 9→10 마이그레이션의 잔여 정리(`@eslint/eslintrc` 미사용 devDependency 제거)와, 이미 이전 PR(#1219, `1b17701aa`)에서 도입된 `preserve-caught-error` 규칙 대응 `cause: err` 부착 코드를 **회귀 테스트로 잠그는** 작업이다. `spec/5-system/5-expression-language.md`(`code:` frontmatter 에 `expression-resolver.service.ts` 명시)와 간접적으로 `spec/5-system/4-execution-engine.md` 가 커버 영역이라 harness 가 이 스코프를 골랐을 뿐, spec 본문 어디에도 수정이 없어 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 충돌 표면이 존재하지 않는다.
  - 제안: 조치 불요 — 정보성 기록. harness 라우팅이 "코드 변경 → 커버 spec 영역" 매핑만으로 대상을 정하면 이런 무충돌 케이스가 반복될 수 있으니, 차기 라운드에서 diff 가 순수 devDependency/테스트-only 인 경우 cross-spec 체크를 생략하는 사전 필터를 고려할 만하다(강제 아님).

- **[INFO]** `Error.cause` 부착이 `3-error-handling.md` 의 CWE-209 마스킹 원칙과 상충하지 않음을 실측 확인
  - target 위치: N/A (target 자체엔 변경 없음. 참조 대상은 `spec/5-system/3-error-handling.md` §2.1/§3.2/§6.3의 "내부 원문 미노출/마스킹" 원칙)
  - 충돌 대상: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:317`, `codebase/backend/src/nodes/data/code/code.handler.ts:454` (프로덕션 코드 — 이번 diff 대상 아니고 사전 존재. 이번 diff 는 이 두 지점을 잠그는 `.spec.ts` 테스트만 추가)
  - 상세: `3-error-handling.md` Rationale 은 "4xx http-error message 는 내부 원문을 echo 하지 않고 고정 문구로 직렬화, 원문은 `logger.warn` 으로만 남긴다(CWE-209 방지)"는 원칙을 명시한다. 이번에 잠근 두 지점은 이 원칙과 대상이 다르다 — HTTP 미들웨어 4xx 가 아니라 노드 설정(pre-flight) 평가 실패이며, `3-error-handling.md §3.2` 는 이미 "Pre-flight(config) 에러는 envelope 으로 래핑되지 않고 그대로 throw" 라고 규정한다. 실제 코드도 감싸는 `message` 에 원본 `err.message` 를 이미 포함시킨 뒤 `cause` 를 부착하므로(신규 테스트 주석이 이 근거를 명시), `cause` 는 클라이언트 응답 JSON 이나 §6.2 로그 포맷 어디에도 신규로 직렬화되지 않는 내부 디버깅 전용 체이닝이다. `grep -rn "\.cause" codebase/backend/src` 로 프로덕션 코드 전수 확인한 결과 이 두 지점 외 기존 `telegram-client.ts` 1건뿐이며 응답 직렬화 경로에 `.cause` 를 노출하는 코드는 없다. 즉 §3.2 "details 필드에 stack 등 노드별 부가 정보 허용" 원칙과도 상충하지 않는다(오히려 그 범주에 가깝다).
  - 제안: 조치 불요 — 향후 `.cause` 를 REST 응답(`output.error.details`)이나 §6.2 JSON 로그에 명시적으로 직렬화하는 후속 변경이 생기면, 그 시점에 §6.3 마스킹·CWE-209 원칙 재검토가 필요하다는 점만 인지해 두면 된다.

### 요약

이번 diff 는 ESLint 9→10 업그레이드의 잔여 정리(미사용 `@eslint/eslintrc` devDependency 제거)와, 이미 프로덕션에 존재하던 `cause: err` 에러 체이닝 두 지점(`expression-resolver.service.ts`, `code.handler.ts`)을 회귀 테스트로 고정하는 작업으로, spec 문서 변경이 전혀 없고 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 다른 spec 영역과 충돌할 표면이 없다. 유일하게 짚을 만한 점은 harness 가 지정한 검토 스코프(`spec/5-system/`)와 실제 코드 변경 범위가 (frontmatter `code:` 매핑 경유로) 간접적으로만 연결돼 있어 spec 본문 자체엔 아무 변경이 없다는 라우팅상의 불일치이며, 이는 실질 리스크가 아니라 기록성 INFO 다. `Error.cause` 부착이 `3-error-handling.md` 의 CWE-209 마스킹 원칙과 상충하지 않는다는 점도 실제 소스(GlobalExceptionFilter 미해당 경로·클라이언트 응답 미직렬화)로 확인했다.

### 위험도
NONE
