# RESOLUTION — 2026/08/01/12_27_15

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Warning #1 (Documentation) | 코드 | `b268ed671` | `PROJECT.md:49` "typescript 1건" → "typescript·eslint-plugin-unicorn 2건"으로 갱신 + `.github/dependabot.yml` ignore 블록 개수와 동기화하라는 2-place 결속 문구 추가, eslint-plugin-unicorn 사고 배경·근거 신설 |
| Warning #2 (Testing) | 코드 | `b268ed671` | backend jest 에 `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`(+ 순수 로직 `eslint-unicorn-peer-guard.ts`, 앵커 fixture `eslint-unicorn-peer-fixture.ts`) 신설. `unicorn/catch-error-name` 실발화 3케이스(위반/준수/`^_` 면제) + 설치된 unicorn peer eslint range ↔ backend 선언 eslint range 정합 2케이스 + 합성 파서/비교 단위 테스트. mutation 3종으로 non-vacuous 확인(본 절 하단) |
| Warning #3 (Maintainability) | 코드 | `b268ed671` | unicorn 버전별 eslint peer floor 실측 표를 `codebase/backend/eslint.config.mjs`(unicorn 등록 블록 주석) 단일 SoT로 두고, `.github/dependabot.yml`·`plan/in-progress/eslint-unicorn-peer-restore.md` 는 표를 지우고 결론+참조 문구로 축약 |
| INFO #5 (부수) | 코드 | `b268ed671` | plan 문서의 "3년 가까이 유효한 근거다"를 실측(v57 릴리스 2025-02-17, 경과 약 1.5년)에 맞게 정정 |
| INFO #12 (부수) | 코드 | `b268ed671` | `eslint.config.mjs`·`.github/dependabot.yml` 주석에 "^56 은 caret range(56.x minor/patch 자동 허용)이지 exact pin 아님"을 명시해 "고정" 어휘의 오해 소지 보강 |

Critical 0건, 그 외 INFO 13건은 전부 "조치 불요"로 이미 판정되어 있어(SUMMARY 자체 결론) 추가 조치하지 않음 — 아래 §보류·후속 항목 참고.

### Warning #2 mutation 검증 (non-vacuous 증명)

새 테스트가 실제로 실행되고 실질 위반을 잡는지 3가지 독립 뮤턴트로 확인했다(각각 커밋 전 `cp` 백업 → 뮤턴트 적용 → RED 확인 → `cp` 복원 → `git status`/`diff` 로 diff 0 재확인):

| 뮤턴트 | 대상 | 결과 |
| --- | --- | --- |
| `unicorn/catch-error-name` 을 `'off'` 로 변경 | `eslint.config.mjs` | "발화 1건" 단언 실패(0건 수신) — **RED** ✅ |
| backend `eslint` 선언을 `^9.18.0` → `^7.0.0` (unicorn peer 미달) | `package.json` | "backend 선언 floor 가 unicorn peer 를 만족" 단언 실패 — **RED** ✅ |
| 원복 3건 | 둘 다 | `git diff` 0, `npx jest eslint-unicorn-peer.spec.ts` 28/28 재통과 |

세 번째 축(설치된 eslint 실측 버전이 peer 를 만족하는지)은 실제 node_modules 값을 직접 읽으므로, 위 두 뮤턴트가 커버하는 "선언 floor" 축과 "룰 발화" 축이 논리적으로 겹치지 않는 별도 코드 경로라 별도 뮤턴트 없이도 vacuous 위험이 낮다고 판단(같은 `satisfiesFloor` 호출부이지만 입력 소스가 다르고, 두 번째 뮤턴트가 그 함수 자체의 반응성은 이미 실증).

## TEST 결과

- lint  : 통과 (51s)
- unit  : 통과 (73s, backend jest 413 suites/8389 tests passed — `eslint-unicorn-peer.spec.ts` 28/28 포함, 독립 실행으로 재확인)
- build : 통과 (146s)
- e2e   : 통과 (307s: backend jest 260 + playwright 51 passed(1.2m), 실 인프라 postgres·redis·minio·backend-e2e 전부 `Healthy`. 로그의 `failed` 매칭 1건은 파일명(`execution-failed-notification.e2e-spec.ts`)에 의한 오탐으로 실물은 `PASS` — ANSI 제거 후 전수 grep 으로 확인)

## 보류·후속 항목

- INFO #1~#4, #6~#11, #13~#15: SUMMARY 자체가 "조치 불요"로 판정한 항목(대부분 NONE 위험도 reviewer 의 참고성 관찰) — 추가 조치 없음.
- spec draft 없음 — 이번 세션의 Warning 3건은 모두 devDependency/CI 설정/문서/테스트 영역으로, spec 결함이나 SPEC-DRIFT 에 해당하는 항목이 없었다(`spec_impact: none`, plan frontmatter 와 일치).
- 민감 변경 가드 해당 없음 — DB 마이그레이션·외부 API 계약·인증·결제·의존성 메이저 버전 변경 없음(이번 조치는 문서·테스트·주석 추가뿐, `d30c473df`/`7c10c9f02` 의 실제 버전 롤백은 이전 커밋에서 이미 완료·검증됨).
