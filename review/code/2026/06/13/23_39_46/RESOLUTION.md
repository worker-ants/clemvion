# RESOLUTION — ai-review 23_39_46 후속

대상 변경: refactor 04 후속 B-3 (BCRYPT_ROUNDS 공용화) + B-2 (비밀번호 변경 user-guide).
전체 위험도 **LOW**, Critical 0, Warning 4. 아래 disposition 적용.

## Warning 처리

| # | 카테고리 | disposition | 조치 |
|---|----------|-------------|------|
| 1 | Architecture | **FIXED** | `password.util.ts` 에 `comparePassword(plain, hash)` 추출. `auth.service.ts`(L300)·`users.service.ts`(L81) 의 `bcrypt.compare()` 직접 호출 교체. 양 서비스에서 `bcrypt` 직접 import 제거 → 비밀번호 해시/검증 SoT 가 `password.util` 한 곳으로 완성. `comparePassword` unit 2건 추가. (commit 15069f39) |
| 2 | SPEC-DRIFT | **DEFERRED → planner** | 코드는 올바르고 `spec/2-navigation/13-user-guide.md` §2 IA 트리에 신규 `password-and-sessions` 행이 누락. 코드 변경 불요(revert 불필요). 후속 project-planner spec PR(refactor 04 후속 B-1·A-2 묶음)에서 IA 트리 1행 추가로 해소 예정. developer 는 `spec/` write 불가라 본 dev PR 범위 밖. |
| 3 | Testing | **FIXED** | `auth.service.spec.ts` fixture 6곳의 `bcrypt.hash('...', 12)` → `bcrypt.hash('...', BCRYPT_ROUNDS)`. `BCRYPT_ROUNDS` import 추가. rounds 변경 시 fixture 자동 동기화. (commit 15069f39) |
| 4 | Documentation | **DISMISSED (false positive)** | `password-and-sessions.en.mdx` frontmatter 부재는 결함 아님. 검증: `.en.mdx` 37개 중 28개가 frontmatter 없는 body-only(다수 관례)이며, docs 로더(`src/lib/docs/registry.ts`·`locale.ts`)가 EN 메타데이터를 KO 파일의 `title_en`/`summary_en` 에서 읽음. `security-2fa.en.mdx`(frontmatter 보유)는 소수 레거시. 신규 페이지는 다수 관례(body-only)를 따른 것이 맞음. docs registry 테스트 2196건 PASS 로 로딩 정상 확인. |

## INFO 처리 (참고 — 필수 아님)

- **out-of-scope 기존 기술 부채** (INFO 2·4·7·8): `checkEmail` enumeration·`AuthService` God Service·`login` 복잡도·매직넘버 `300` — 모두 이번 변경 범위 밖 기존 부채. 별도 과제 추적. 본 PR 미반영.
- **INFO 5** (`DOCS.workspaceAndTeam.passwordAndSessions` 딥링크 상수): 즉각 동작 장애 없음(가이드는 registry 라우팅으로 정상 동작). 선택적 후속.
- **INFO 1·3·6·9·10·11**: 수용 가능/선택적(주석·엣지케이스 테스트). 본 PR 미반영.

## 검증 (TEST WORKFLOW 재수행)

- backend build: PASS (`nest build`)
- backend unit: password.util(8) + users.service + auth.service = 56 PASS
- 변경 파일 lint: clean (auth.service.spec L35·L993 lint 경고/에러는 origin/main 기존 이슈, 변경 라인 외 — `eslint --fix` 자동 처리 대상, 본 변경 무관 scope 유지 위해 미수정)
- frontend docs registry 테스트: 2196 PASS (신규 페이지 로딩·parity 검증)
- e2e: (실행 결과 본 파일 하단/PR 체크리스트 반영)

## ESCALATE

- `spec` — W2 SPEC-DRIFT 은 planner spec PR 에서 처리(별도 트랙). 그 외 user-decision/infra 없음.
