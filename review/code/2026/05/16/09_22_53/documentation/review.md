# 문서화(Documentation) 리뷰

리뷰 대상: Makefile, backend/src/modules/integrations/third-party-oauth.controller.spec.ts, plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md, review/consistency/2026/05/16/09_13_51/SUMMARY.md

---

### 발견사항

- **[INFO]** Makefile `e2e-up` 타겟 help 설명과 실제 동작 불일치 가능성
  - 위치: `Makefile` 라인 12 (`help` 타겟)
  - 상세: `e2e-up` help 텍스트(`e2e 인프라 + backend-e2e 까지 백그라운드 기동 (runner 제외)`)는 `--build` 추가 이후에도 변경되지 않았다. `--build` 플래그가 추가됨에 따라 "매번 이미지를 빌드한다"는 동작 특성이 help 설명에 없으면 처음 보는 사용자가 `make e2e-up` 의 비용(빌드 시간)을 예상하지 못할 수 있다.
  - 제안: help 텍스트를 `e2e 인프라 + backend-e2e 빌드·기동 (runner 제외, --build 로 stale 이미지 방지)` 식으로 보완하거나, 기존 설명에 `(이미지 재빌드 포함)` 한 구절을 추가한다.

- **[INFO]** README.md 에 `make e2e-test` 사용법이 빠져있음
  - 위치: `README.md` 스크립트 테이블 (라인 228 근방)
  - 상세: README 의 스크립트 테이블(`Backend` 열)에는 `npm run test:e2e` 만 기재되어 있고 `make e2e-test` / `make e2e-test-full` / `make e2e-up` 등 Makefile 타겟은 전혀 언급되어 있지 않다. 이번 변경으로 `--build` 동작이 기본화되었으므로 `npm run test:e2e` 와 `make e2e-test` 의 차이(Docker 격리 여부, 이미지 재빌드 여부)를 설명할 문서 위치가 없다.
  - 제안: README 스크립트 테이블 또는 별도 "E2E 테스트 실행" 항목에 `make e2e-test`, `make e2e-test-full`, `make e2e-up / e2e-down` 타겟과 각각의 용도를 한 줄씩 추가한다. 이미 `docker-compose.e2e.yml` 파일이 루트에 존재하지만 README 에서 참조가 없다.

- **[INFO]** CHANGELOG.md 에 이번 인프라 변경 기록 없음
  - 위치: `CHANGELOG.md`
  - 상세: 현재 CHANGELOG.md 의 Unreleased 섹션은 Node Output Contract Unification 관련 Breaking Changes 에 집중되어 있다. 이번 `--build` 플래그 추가는 Breaking Change 는 아니지만, `make e2e-test` 의 동작 특성(매번 이미지 재빌드)이 바뀌어 팀원 개발 사이클에 영향을 준다. 특히 첫 실행 시 빌드 시간이 증가한다는 점은 주목할 만한 변경이다.
  - 제안: CHANGELOG.md Unreleased 섹션 아래에 `### Fixes` 또는 `### Infra` 항목을 추가해 "e2e Makefile 타겟에 `--build` 플래그 추가 — stale Docker 이미지로 인한 silent 404 방지 (2026-05-15 background-monitoring 결함 후속)" 한 줄 기재를 권장한다. 필수 수정은 아니나 히스토리 추적에 도움이 된다.

- **[INFO]** `third-party-oauth.controller.spec.ts` 타입 변경에 인라인 주석 없음
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L428~430
  - 상세: `Record<string, unknown>` → `Record<string, string>` 변경은 `@typescript-eslint/no-base-to-string` 린트 오류 해소를 위한 것임이 plan 문서에는 설명되어 있으나, spec 파일 자체에는 해당 이유를 알 수 있는 주석이 없다. 이 변경만 보면 왜 타입을 좁혔는지 맥락을 파악하기 어렵다.
  - 제안: 변경 라인 위에 `// 'Content-Type' 헤더 값은 항상 string — Record<string, string>으로 좁혀 no-base-to-string 린트 해소` 수준의 짧은 주석을 추가하면 추후 리뷰어가 의도를 바로 파악할 수 있다. 의무는 아니나 권장.

- **[INFO]** plan 문서 `후속` 섹션에 담긴 CI 확인 항목이 문서화되지 않음
  - 위치: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — `## 후속` 섹션
  - 상세: `(선택) .github/workflows/* 가 make e2e-test 를 그대로 호출하는지 확인` 항목이 체크박스가 아닌 산문으로만 기술되어 있다. 이 내용이 완료되지 않은 채로 PR 이 머지되면 추적이 어려워진다.
  - 제안: 후속 항목을 `- [ ]` 체크박스 형식으로 변환하거나, 이미 선택 사항임을 명시했다면 plan 체크리스트에도 `- [ ] (선택) CI workflow make e2e-test 호출 경로 확인` 형태로 등재해 명확하게 추적 가능한 상태로 둔다.

---

### 요약

이번 변경(Makefile `--build` 플래그 추가, spec 파일 타입 좁히기, plan/review 문서 신규 생성)은 전반적으로 문서화 품질이 양호하다. Makefile 내 인라인 주석이 변경 의도(stale 이미지 방지, BuildKit cache 재사용)를 명확히 설명하고 있으며, plan 문서도 근본 원인·증거·작업 범위를 상세히 기술하고 있다. 다만 README.md 에 `make e2e-*` 타겟 자체가 언급되지 않아 처음 접하는 개발자가 Docker 기반 e2e 실행 방법을 파악하기 어렵고, CHANGELOG.md 에도 이 인프라 변경이 기록되어 있지 않다. `help` 타겟 텍스트에 `--build` 동작 안내가 빠진 점도 소규모 불일치로 남아있다. 모두 CRITICAL 또는 WARNING 수준의 결함이 아닌 INFO 등급의 개선 권고이므로 즉각 차단이 필요한 문서화 결함은 없다.

### 위험도

LOW
