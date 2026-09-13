# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(테스트 커버리지 갭, 뮤테이션으로 실증). 나머지는 전부 INFO 또는 해당 없음. forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 목록 미이행 없음.

이번 diff 는 애플리케이션 런타임 코드가 아니라 유저 가이드(MDX)가 인용하는 UPPER_SNAKE 식별자(에러 코드+환경변수)의 실재성을 검증하는 vitest 가드의 리네임/재설계(`guide-error-code-*` 삭제 → `guide-identifier-*` 신설)이며, **직전 `/ai-review` 라운드(`14_41_14`)의 WARNING 6건에 대한 RESOLUTION 반영**이 함께 포함돼 있다. 14개 reviewer 전원이 실제 소스를 직접 열람·실행(`vitest run`, `grep`)해 그 6건이 실제로 해소됐음을 교차 확인했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `collectEnvDeclarations` 의 "주석 처리된 env 선언(`#SOME_VAR=`)" 매칭 분기가 완전히 무검증 — `envLine` 정규식의 `^#?\s*` 중 `#` 허용 부분을 제거하는 뮤테이션을 가해도 19/19 테스트가 그대로 GREEN(실측 확인). 실제 코퍼스(`.env.example`)에도 이 형태 줄이 0건이라 오늘은 이 분기가 실행될 일이 없음 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`collectEnvDeclarations` 내 `envLine`) | `scanIdentifierCitations` 의 축별 대조군과 같은 패턴으로 `"#SOME_VAR=x\n"` 형태 합성 단위 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | **[SPEC-DRIFT]** `spec/conventions/user-guide-evidence.md §2` 가 "Build-time 가드 (3건)"으로 서술하나 실제로는 5건(`guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·`guide-sanitized-message-parity.test.ts`가 표·frontmatter `code:` 목록에 미등재) — 코드는 실측(뮤테이션 7건 등)으로 견고하고 문제는 spec 쪽 미갱신. `developer` 는 `spec/` 쓰기 권한이 없어 직접 고칠 수 없음 | `spec/conventions/user-guide-evidence.md:1-14, 68` | 조치 불요(이 PR 범위 아님) — `project-planner` 턴에서 §2 표제·표 2행·frontmatter `code:` 갱신. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 에 `- [ ]` 미해결 항목으로 등재돼 있음(requirement·documentation·user_guide_sync 3개 reviewer + 이전 라운드 3개 consistency checker 수렴 지적, 이번이 통산 6번째 독립 확인) |
| 2 | 회귀 확인 | 직전 라운드(`14_41_14`)가 지적한 WARNING 6건 — (1)자매 파일(`guide-sanitized-message-parity.test.ts:16`)의 죽은 파일명 참조, (2)`composeTexts` 가 저장소 루트의 모든 `.yml`/`.yaml`(`pnpm-lock.yaml` 784KB 포함)을 읽던 과다 스코프, (3)"존재 검사≠방출 검사" 한계 주석·"지우지 말 것" 지시 소실, (4)`CHANGELOG.md`/`PROJECT.md` 문구 drift, (5)실제 코퍼스 명명 회귀 단언 소실 — 전부 이번 커밋에서 소스 레벨로 해소됨을 9개 reviewer(security·performance·architecture·requirement·scope·side_effect·maintainability·documentation·dependency)가 각자 독립적으로 재확인(grep·Read·vitest 실행) | `guide-identifier-existence.test.ts:48-56,95-107`, `guide-identifier-scan.ts:53-76`, `guide-sanitized-message-parity.test.ts:16`, `CHANGELOG.md:66-81`, `PROJECT.md:300` | 조치 불요 — 회귀 방지 기록 |
| 3 | Architecture | `guide-identifier-scan.ts`(214줄) 가 세 이질적 축(가이드 파싱 정규식/외부 어휘 허용목록/소스·인프라 기준집합 수집기)을 한 파일에 계속 누적 — 오늘은 응집도 문제 아니나 이 PR 자체가 "축이 하나 더 필요해졌다"는 이력을 반복 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체 | 지금 조치 불요. 허용목록 상한(5) 근접 또는 축 4개 초과 시 axis-scanning/basis-collection 모듈 분리 검토 |
| 4 | Architecture/Performance | `collectEnvDeclarations` 기준집합 병합이 오늘 시점 판정을 지탱하지 않음(뮤테이션으로 함수 제거해도 GREEN) — 코드·plan·테스트 세 곳이 이 사실을 스스로 disclose 하고 "내일의 오탐 방지" 목적을 명시 | `guide-identifier-scan.ts:175-214`, `guide-identifier-existence.test.ts:81-93` | 조치 불요 — 근거·전환 신호가 코드에 이미 명시됨 |
| 5 | Maintainability | 정규식 `lastIndex` 리셋 → `exec` 루프 → 컬렉션 적재 뼈대가 파일 내 4회 반복 — 단, 이 폴더의 형제 가드 파일들(`impl-anchor-parse.ts`, `spec-links.ts` 등)도 동일 패턴을 반복하는 기존 관례라 이번 diff 의 신규 결함 아님 | `guide-identifier-scan.ts:139-145,162-172,196-212` | 지금 조치 불요. 폴더 전체에서 패턴이 5회 넘거나 가드가 더 늘면 공유 `matchAll` 유틸 검토 |
| 6 | Maintainability/Documentation | 설계 근거(축별 실측표·허용목록 번복 서사)가 소스 헤더·테스트 JSDoc·plan 문서 세 곳에 축약 없이 반복 — 이미 전 라운드에서 지적, 상태 변화 없음 | `guide-identifier-scan.ts:1-52`, `guide-identifier-existence.test.ts:18-27`, `plan/in-progress/guide-identifier-existence.md` §A~D | 조치 불요. 다음 축 변경 시 코드 헤더 단일화 검토 |
| 7 | Documentation | Unicode `\b` 워드 경계가 한국어에 미성립한다는 교훈이 옛 축(문맥 게이팅) 삭제와 함께 코드에서 완전히 소실 — 이미 저위험/조치불요로 처분된 사안 | 삭제된 `guide-error-code-scan.ts` 의 `TABLE_HEADER_WITH_CODE` (대응 코드 없음) | 조치 불요 유지. 향후 유사 정규식 작성 지점에 캐치올 주석 이관 권장(이번 PR 범위 아님) |
| 8 | Scope | 가드 파일 교체가 `git mv` 아닌 delete+create 로 이뤄져 파일 이력이 끊김 — 축 구조 자체가 재설계돼 순수 리네임이 아니었으므로 타당, 전 라운드 RESOLUTION 이 이미 "다음엔 리네임과 재작성을 분리" 를 후속 교훈으로 명시 | `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`(삭제) → `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`(신규) | 조치 불요(회고적 이력 재작성 비용 > 이익) |
| 9 | Scope | `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 작업과 무관한 백로그 항목(`cafe24-api-metadata.md §4` Principle 오인용) 1건 추가 — 항목 자체가 "이번 PR과 무관·developer 권한 밖" 이라고 명시해 은폐 없음, 전 라운드와 동일 처분 유지 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 정적 스캐너, ReDoS/시크릿 노출 위험 없음. env 축은 이름만 수집(값 미노출) |
| performance | NONE | 이전 라운드 compose 과다 수집 WARNING 실측 해소 확인, 정규식 전부 선형 |
| architecture | LOW | 이전 WARNING 2건 해소 확인. 파일 3축 누적·env 병합 무기여 등 INFO만 |
| requirement | LOW | 기능 완결(19/19, 3316/3316 통과). 유일 미해소는 spec 문서 갱신 누락([SPEC-DRIFT], 권한 밖) |
| scope | NONE | 스코프 목적에 정확히 수렴, review 산출물 동반 커밋은 정상 워크플로 |
| side_effect | NONE | 순수 함수 + 읽기전용 fs 접근 유지, 이전 WARNING 2건 해소 확인 |
| maintainability | LOW | 핵심 로직 견고, 정규식 boilerplate 반복·설계 근거 3중 복제는 INFO |
| testing | LOW | 성숙한 테스트 설계, `collectEnvDeclarations` 주석-처리 분기 1건 무검증(WARNING) |
| documentation | LOW | 전 라운드 문서화 WARNING 4건 전부 해소 확인, 잔존은 이미 등재된 항목 |
| dependency | NONE | 신규 외부 패키지 0건, 내부 crossref WARNING 해소 확인 |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음 — 전부 동기 단일 프로세스 실행 |
| api_contract | NONE | 해당 없음 — API 표면 변경 없음 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 매칭 0건 — 가드 harness 자체 변경, 제품 표면 무변경 |

## 발견 없는 에이전트

database, concurrency, api_contract — 리뷰 대상 코드 성격상 해당 관점 자체가 적용되지 않음("해당 없음").

## 권장 조치사항

1. (developer, 선택) `collectEnvDeclarations` 의 "주석 처리된 env 선언" 매칭 분기를 겨눈 합성 단위 테스트 추가 — `scanIdentifierCitations` 축별 대조군과 동일 패턴으로 `"#SOME_VAR=x\n"` 케이스. 실제 코퍼스에 해당 형태가 없어 긴급하지 않음.
2. (project-planner, 이미 등재됨 — 재작업 불요) `spec/conventions/user-guide-evidence.md §2` 를 "가드 3건"→"5건"으로 갱신하고 `guide-identifier-existence.test.ts`/`guide-sanitized-message-parity.test.ts` 를 표·frontmatter `code:` 목록에 추가. `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 항목 처리 시 함께 반영.
3. (선택, 저우선) 정규식 매칭 boilerplate(4회 반복) 공유 유틸화는 이 폴더의 가드 개수가 더 늘어날 때 검토.
4. (선택, 저우선) 설계 근거 서사(축별 실측표)의 소스/테스트/plan 3중 복제는 다음 축 변경 시 코드 헤더 단일화로 정리 검토.

## 라우터 결정

`routing_status=skipped` — 라우터 미사용(사유 미기재). 전체 reviewer 14명 실행, forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 포함 전원 결과 확보됨. 제외된 reviewer 없음.