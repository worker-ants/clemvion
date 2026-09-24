# 신규 식별자 충돌 검토 — `spec-draft-frontmatter-pending-plans.md`

## 발견사항

없음.

target 문서(`plan/in-progress/spec-draft-frontmatter-pending-plans.md`)는 `spec/5-system` 세
문서(`10-graph-rag.md`·`8-embedding-pipeline.md`·`4-execution-engine.md`)의 frontmatter
`pending_plans:` 리스트에서 **오염된 기존 항목을 제거**하는 정정 작업이며, 새로운 요구사항
ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로를 하나도 도입하지 않는다.
점검 관점별로 확인한 근거는 다음과 같다.

1. **요구사항 ID** — 새로 부여되는 ID 없음. 기존 마이그레이션 파일 경로(`V026`·`V027`·`V037`)를
   `pending_plans:` 에서 `code:` 리스트 끝으로 **되돌리는** 것뿐이며, 이 세 경로는 이미
   `codebase/backend/migrations/` 에 실재하는 기존 자산이다(target A-1). 새 ID 발급이 아니다.
2. **엔티티/타입명** — 신규 DTO·인터페이스·엔티티 없음.
3. **API endpoint** — 신규 endpoint 없음.
4. **이벤트/메시지명** — 신규 webhook/queue/SSE 이벤트 없음.
5. **환경변수/설정키** — `pending_plans:` 자체가 신규 키가 아니라 `spec/conventions/spec-impl-evidence.md`
   §2.1(line 68)·§3(line 82)에 이미 정의된 정식 frontmatter 키이며, target 은 그 기존 정의를
   그대로 준수한다(값을 정정할 뿐 키 의미를 바꾸지 않음). 새 config key 도입 없음.
6. **파일 경로** —
   - target plan 자신의 경로 `plan/in-progress/spec-draft-frontmatter-pending-plans.md` 는
     `git log --all -- <path>` 결과 이력이 없는 순수 신규 파일이며, `plan/in-progress/`·
     `plan/complete/` 어느 쪽에도 동일 이름의 기존 파일이 없다(확인함: `plan/complete/`에는
     유사 이름의 `fix-spec-frontmatter-catalog.md` 가 있으나 다른 이름이라 경로 충돌 아님).
   - `spec-draft-<topic>` 명명은 `spec-draft-eia-62-waiting-payload.md`·
     `spec-draft-eia-notification-payload-contract.md`·`spec-draft-nullable-notation-followups.md`
     등 기존 `plan/in-progress/` 컨벤션과 일치한다(INFO 대상도 아님 — 이미 통용 중인 패턴).
   - target 이 언급하는 `execution-engine-residual-gaps.md`·`retry-turn-terminal-guard.md`·
     `update-returning-tuple-shape.md`·`exec-intake-followups.md` 는 모두 기존에 실재하는
     plan 경로를 **참조**할 뿐 새로 명명하지 않는다.

## 요약

target 문서는 새 식별자를 도입하는 spec 초안이 아니라, 기존 `pending_plans:` frontmatter 값의
오염(YAML 키 삽입 위치 오류로 인한 오분류, `implemented` 상태에서의 잔존 키, 이미 `complete/`
로 이동한 plan 에 대한 stale 참조)을 제거·정정하는 유지보수성 변경이다. 요구사항 ID, 엔티티/
타입명, API endpoint, 이벤트명, 환경변수/설정키, 파일 경로 어느 축에서도 새로 부여되는 식별자가
없으므로 신규 식별자 충돌 관점에서는 검토 대상 자체가 성립하지 않는다(N/A에 가까움). target 이
인용하는 기존 식별자(마이그레이션 파일 경로, plan 파일 경로, `pending_plans:` 키)는 모두 기존
정의·실재와 정확히 일치해 재사용상 혼선도 없다.

## 위험도

NONE
