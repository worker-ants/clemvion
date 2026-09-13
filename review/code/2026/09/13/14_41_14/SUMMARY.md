# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능/보안/성능/DB/동시성/API계약 관점에서는 CRITICAL·기능 결함이 전혀 없는 문서-정합성 가드 리팩터(`guide-error-code-*` → `guide-identifier-*`)다. 다만 **6명의 독립 리뷰어(architecture·side_effect·maintainability·documentation·dependency·requirement)가 동일하게** 리네임 스윕이 자매 파일(`guide-sanitized-message-parity.test.ts:16`)의 죽은 파일명 참조를 놓쳤다고 수렴 지적했고, documentation 리뷰어는 추가로 삭제된 원본 파일이 명시적으로 "지우지 말 것"이라 못박았던 핵심 한계 설명(존재 검사 ≠ 방출 검사, `MAKESHOP_UNRESOLVED_PATH_PARAM` 실측 사례)이 재작성된 `guide-identifier-scan.ts` 자체에서 소실됐음을 확인했다 — 코드는 동작하지만 다음 사람이 소스만 보고 판단할 때 오도될 수 있는 지점들이다. forced 화이트리스트(7명) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 정합성 | 리네임(`guide-error-code-*`→`guide-identifier-*`) 스윕이 자매 파일의 현재형 상호참조를 놓쳤다 — "자매 `guide-error-code-existence.test.ts` 는 코드 토큰의 실재를 본다"가 존재하지 않는 파일명을 가리킴. 6개 리뷰어(architecture·side_effect·maintainability·documentation·dependency·requirement)가 독립적으로 동일 지점 지적 | `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` | `guide-error-code-existence.test.ts` → `guide-identifier-existence.test.ts` 로 정정 (developer 스코프 안, 1줄 수정) |
| 2 | 유지보수성/부작용 | `composeTexts`/`collectEnvDeclarations` 가 "compose 파일"이 아니라 저장소 루트의 모든 `.yml`/`.yaml`을 확장자만으로 필터링 — `pnpm-lock.yaml`(784KB)·`pnpm-workspace.yaml`도 매 테스트 실행마다 읽어 정규식 스캔. 오늘은 매치 0건이라 무해하나 이름·JSDoc이 약속하는 범위보다 실제 구현 범위가 넓은 암묵적 결합. 3개 리뷰어(architecture·side_effect·maintainability) 수렴 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:48-51` | `docker-compose*.yml` 등 명시적 패턴으로 좁히거나, 확장자만으로 충분한 실측 근거를 주석으로 고정 |
| 3 | 문서화 | 삭제된 `guide-error-code-scan.ts` 가 명시적으로 "이 주석을 지우지 말 것"이라 못박았던 핵심 한계 설명(존재 검사 ≠ 방출 검사, `MAKESHOP_UNRESOLVED_PATH_PARAM` 실측 사례, AST 대안 기각 근거)이 재작성된 `guide-identifier-scan.ts` 상단 주석에서 통째로 소실됨 — `PROJECT.md`/plan 트래커에는 남아 있으나 정작 이 파일을 직접 여는 다음 사람이 가장 먼저 볼 자리에서 빠짐 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (원본 대비 해당 절 부재) | 삭제된 절(맹점 설명 + "지우지 말 것" 지시)을 식별자 축(env 변수)까지 포괄하도록 일반화해 상단 주석에 복원 |
| 4 | 문서화 | `CHANGELOG.md`의 `## Unreleased` 항목이 이번 리네임·설계 번복을 반영하지 않음 — 파일명이 `guide-error-code-existence`로 남아 있고, "허용목록 없음"이라 적혀 있는데 이번 PR이 정확히 그 원칙을 번복해 `GUIDE_EXTERNAL_VOCABULARY` 허용목록을 도입했으며, "가드 주석에 적었다"는 문장도 발견 #3으로 인해 더 이상 사실이 아님 | `CHANGELOG.md:66-76` | 같은 Unreleased 섹션에 파일명·허용목록 도입·4강제 요약을 반영해 갱신 |
| 5 | SPEC-DRIFT (선재 추적 중) | `spec/conventions/user-guide-evidence.md §2`가 "Build-time 가드 3건"이라 세지만 실제로는 5건(`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts` 미등재) — 이번 PR이 새로 만든 결함은 아니고 `#1330` 시점부터 있던 선재 갭이나, requirement 리뷰어가 4번째 독립 확인으로 재검증함 | `spec/conventions/user-guide-evidence.md:68` | 코드 수정 불요(developer 스코프 밖). `project-planner` 가 §2 표제·표 2행·frontmatter `code:` 목록을 한 턴에 갱신 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247`에 미해결 항목으로 등재돼 있어 별도 신규 등재 불필요 |
| 6 | 테스트 | 구 스위트가 갖고 있던 "실제 코퍼스의 특정 파일·토큰을 명명해 고정하는 회귀 테스트"(예: `discord.en.mdx`의 `EXECUTION_TIMEOUT`)가 신규 스위트에서 사라지고 전부 합성 fixture로 대체됨 — 총량 floor·집계 임계값은 개별 토큰 하나가 빠져도 여전히 통과할 수 있어 좁은 회귀 형태를 가릴 여지가 남음 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (대응 실제-코퍼스 명명 단언 부재) | 최소 1개는 실제 mdx 파일 + 실제 토큰을 지정하는 회귀 단언을 새 axis(`backtick`) 이름으로 유지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/성능 | `UPPER_SNAKE` 등 정규식은 `_` 구분 앵커로 분리돼 있어 이차 백트래킹(ReDoS) 형태가 아니며, 입력도 신뢰된 저장소 콘텐츠로 한정되어 실질 위험 없음 | `guide-identifier-scan.ts` 정규식군 | 조치 불요 |
| 2 | 보안 | `.env.example`/compose 스캔은 변수 **이름**만 수집하고 값은 버려 시크릿 노출 경로 아님 | `collectEnvDeclarations` | 조치 불요 |
| 3 | 보안 | "존재 검사 ≠ 방출 검사" 한계는 보안 취약점이 아니라 문서-구현 정합성 문제이며 이미 별도 트랙(`naming_collision` CRITICAL, `plan/in-progress/spec-draft-nullable-notation-followups.md`)에서 처리 중 | 전체 | 보안 관점 조치 불요 |
| 4 | 성능 | `collectEnvDeclarations`/compose 스캔이 "오늘 판정을 지탱하지 않는다"는 사실이 코드 주석·plan·테스트 세 곳에 뮤테이션 실측으로 일관되게 disclose됨(내일의 오탐 방지 목적) | `guide-identifier-scan.ts:158-165` | 조치 불요, 트레이드오프 인지만 유지 |
| 5 | 성능 | 가드 파일마다 backend+packages 소스를 독립 재적재 — 이번 PR이 새로 만든 비용 증가는 아니며 기존 자매 가드와 동일 패턴 | `guide-identifier-existence.test.ts:35-38` | 가드 개수가 더 늘면 소스 텍스트 1회 로딩 공유 헬퍼 검토 |
| 6 | 아키텍처 | 과거 결함 재현 테스트가 삭제된 구현의 정규식 리터럴을 손으로 복제 — 원본과의 연결은 git 이력뿐 | `guide-identifier-existence.test.ts:163-167` | 주석에 삭제 커밋 SHA 병기 권장(선택) |
| 7 | 아키텍처 | `guide-identifier-scan.ts`가 세 이질적 책임(axis 정규식/외부 어휘 허용목록/기준집합 수집)을 한 파일에 누적 중 — 오늘은 응집도 문제 없음 | `guide-identifier-scan.ts` 전체 | 축이 4개를 넘거나 허용목록 상한(5) 근접 시 모듈 분리 검토 |
| 8 | 스코프 | 공유 트래커에 이번 작업과 무관한 새 백로그 항목(`cafe24-api-metadata.md §4` Principle 오인용) 추가 — 프로젝트 관례(발견 즉시 등재)를 따른 것이고 PR 스스로 "무관"이라 명시해 투명함 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3406-3414` | 조치 불요 |
| 9 | 스코프 | 파일 교체가 `git mv` 대신 delete+create로 이뤄져 git 이력이 끊김 | 삭제/신규 파일 쌍 | 향후 유사 재설계 시 `git mv` 고려 |
| 10 | 테스트 | `collectEnvDeclarations`가 합성 입력으로 직접 단위 테스트되지 않아 경계 동작(주석 처리된 env 줄 포함 여부, 비-environment YAML 키 포섭 여부)이 코드로 고정되지 않음 | `guide-identifier-scan.ts:167-189` | 합성 스니펫 기반 단위 테스트 1~2개 추가 권장 |
| 11 | 문서화 | Unicode 단어 경계(`\b`)가 한국어에서 성립하지 않는다는 디버깅 교훈이 문맥-게이팅 축 삭제와 함께 코드베이스에서 완전히 소실 | 삭제된 `guide-error-code-scan.ts`의 `TABLE_HEADER_WITH_CODE` | 낮은 우선순위 — 공유 규약 문서에 한 줄로 이관 검토 |
| 12 | 의존성 | 새 외부 패키지 추가 없음, `package.json`/lockfile 변경 없음 확인 | 전체 | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | ReDoS·시크릿 노출 없음. 존재↔방출 검사 한계는 보안 이슈 아님 |
| performance | NONE | 알고리즘 전부 선형, 프로덕션 경로 영향 없음 |
| architecture | LOW | 자매 파일 stale 참조 + compose 필터 과확장 (WARNING 2건) |
| requirement | LOW | 기능 18/18·3315/3315 GREEN 확인. WARNING 2건(자매 참조, SoT 3건→5건 불일치) |
| scope | LOW | 무관 백로그 등재는 관례 준수, delete+create 로 이력 단절만 참고 |
| side_effect | LOW | 자매 참조 + compose 과확장, 나머지는 순수 함수/읽기 전용 확인 |
| maintainability | LOW | 자매 참조 + compose 과확장, 설계 근거 삼중 복제는 참고 수준 |
| testing | LOW | 실제 코퍼스 명명 회귀 fixture 소실(WARNING), 나머지는 vacuity floor·허용목록 메타 테스트 견고 |
| documentation | MEDIUM | 자매 참조 + "지우지 말 것" 한계 주석 소실 + CHANGELOG drift (WARNING 3건) |
| dependency | NONE | 신규 외부 의존성 없음. 자매 참조는 INFO로 보고 |
| database | NONE | DB 관련 코드 없음 |
| concurrency | NONE | 동기 단일 프로세스 정적 스캐너, 동시성 표면 없음 |
| api_contract | NONE | API 계약 관련 코드 없음 |
| user_guide_sync | NONE | 매트릭스 20개 trigger 매칭 0건 — harness-only 변경 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync — 전부 "해당 없음"으로 명시적 확인.

## 권장 조치사항

1. `guide-sanitized-message-parity.test.ts:16`의 자매 파일 참조를 `guide-identifier-existence.test.ts`로 정정 (6개 리뷰어 수렴, developer 스코프 안, 1줄 수정).
2. 삭제됐던 "존재 검사 ≠ 방출 검사" 한계 설명 + "이 주석을 지우지 말 것" 지시를 `guide-identifier-scan.ts` 상단 주석에 식별자 축(env 변수)까지 포괄하도록 일반화해 복원.
3. `composeTexts`/`collectEnvDeclarations`의 파일 선별을 `docker-compose*.yml` 등 명시적 패턴으로 좁히거나, 확장자 필터로 충분한 근거를 주석으로 고정.
4. `CHANGELOG.md`의 `## Unreleased` 관련 섹션을 리네임된 파일명·허용목록 도입 사실로 갱신.
5. (project-planner 턴) `spec/conventions/user-guide-evidence.md §2` 가드 표제·표·frontmatter `code:` 목록을 실제 5건 기준으로 갱신 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재되어 있어 새 항목 불필요, 처리만 하면 됨.
6. 실제 mdx 코퍼스의 특정 파일·토큰을 명명해 고정하는 회귀 단언을 새 axis(`backtick`)로 최소 1개 복원.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(14명) 실행. 별도 스킵 사유 미제공(prompt에 routing_skip_reason 없음).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인됨. 누락 없음.