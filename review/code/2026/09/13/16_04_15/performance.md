# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `collectEnvDeclarations` 병합이 오늘 어떤 판정도 좌우하지 않는 계산을 매 테스트 실행마다 수행한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:205-227` (`collectEnvDeclarations`)
  - 상세: 함수 자체의 JSDoc(196-198행)이 "이 병합을 통째로 빼도 스위트는 GREEN 이다" 를 뮤테이션 실측으로 명시하고 있다. 즉 `.env.example` 2개 파일 + `docker-compose*.ya?ml` 파일들을 매번 정규식(`^#?\s*(UPPER_SNAKE)=`, `^\s+(UPPER_SNAKE):\s`)으로 훑어 `Set` 을 만들지만 현재 코퍼스에서는 산출된 21종 중 가이드가 인용하는 것이 0종이라 `basis` 판정에 기여하지 않는다. 다만 대상 파일들이 전부 수 KB 수준(`.env.example`, `docker-compose.yml`)이라 절대 비용은 무시할 만하고, "내일의 오탐 방지"라는 목적이 코드·plan·테스트 세 곳에 일관되게 문서화·뮤테이션 검증돼 있다(전 라운드 RESOLUTION INFO#4/#5). 새로 지적할 성능 문제라기보다 이미 disclose 된 트레이드오프의 재확인이다.
  - 제안: 조치 불요 — 파일 크기가 작아 반복 계산 비용이 사실상 0에 가깝다. 다만 이 기준집합 병합원이 앞으로 더 늘어난다면(더 많은 env 소스, 더 큰 파일) 그때는 캐싱/공유 헬퍼가 필요해질 수 있다는 점만 기록.

- **[INFO]** 가드별 backend/packages 소스 전수 재적재 — 형제 가드들과 동일 패턴, 이미 트래킹됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:45-48` (`walkTree(root, ["codebase/backend/src", "codebase/packages"], …).map(f => fs.readFileSync(...))`)
  - 상세: 이 `describe` 블록이 모듈 로드 시 backend/packages 전체(실측 500+ 파일, 소스 토큰 1,743종)를 동기적으로 읽어 `Set` 을 만든다. 같은 저장소의 다른 문서 가드(`impl-anchor-existence.test.ts` 등)도 유사하게 backend/packages 트리를 각자 독립적으로 훑는 것으로 보이며, 전체 vitest 스위트를 돌릴 때 동일한 파일들이 가드 개수만큼 중복 I/O 된다. 이번 diff 로 새로 생긴 문제는 아니고(구 `guide-error-code-scan.ts` 도 `collectBackendTokens` 로 동일하게 backend+packages 를 읽었다), 전 라운드 RESOLUTION(INFO#5)에서 "가드별 소스 재적재 — 기존 자매와 동일 패턴, 가드가 더 늘면 공유 헬퍼"로 이미 disposition 됐다. 테스트 실행 시간에만 영향을 주고 런타임(프로덕션 요청 경로)과는 무관하다.
  - 제안: 즉각 조치 불요. 이런 정적 스캐너형 가드가 더 늘어날 경우에만 `describe`-scope 캐시나 vitest `globalSetup` 공유 fixture 로 통합을 고려.

- **[INFO]** (긍정적 회귀 수정 확인) `composeTexts` 수집 범위가 전 라운드 지적대로 이미 좁혀져 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-58`
  - 상세: `/^docker-compose.*\.ya?ml$/` 로 필터링되어 있어, 이전 라운드(`maintainability.md` WARNING, 14_41_14)에서 지적된 "루트의 모든 `.yml`/`.yaml`(`pnpm-lock.yaml` 784KB 포함)을 매 실행마다 정규식으로 훑는" 문제가 해소된 상태다. 새로운 성능 결함은 아니며, 회귀가 없음을 확인하는 차원에서 기록한다.

## 요약

이번 변경 세트의 실질 코드(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`)는 프로덕션 요청 경로가 아니라 vitest 정적 텍스트 스캐너이며, DB·네트워크 호출이 전혀 없고 모든 I/O 는 로컬 리포지토리 파일의 동기 읽기(`fs.readFileSync`/`readdirSync`)로 한정된다. 알고리즘은 파일당 O(라인 수) 또는 O(문자 수)의 선형 정규식 매칭이고 중첩 정량자·백트래킹 위험 패턴이 없어 시간 복잡도 문제는 없다(보안 리뷰어도 ReDoS 형태 아님을 별도 확인). 오히려 이번 재작성은 구 버전의 `codeTableRows`(표 헤더 스캔 후 본문 행 집합 구성) 및 문맥 게이팅 로직을 제거해 계산 경로를 단순화했고, 전 라운드에서 지적된 `composeTexts` 의 과도한 파일 범위(`pnpm-lock.yaml` 784KB 포함)도 `docker-compose*.ya?ml` 로 좁혀 이미 수정된 상태다. 남은 항목은 전부 INFO 수준으로 (1) `collectEnvDeclarations` 병합이 오늘의 판정에 기여하지 않는 계산이지만 대상 파일이 작아 비용이 무시할 만하다는 점, (2) 형제 가드들이 각자 backend/packages 트리를 독립적으로 재적재하는 기존 패턴이 이 PR 로 새로 생긴 것이 아니라는 점이며, 둘 다 전 리뷰 라운드에서 이미 확인·disposition 됐다. 테스트 스위트 실행 시간에 미세한 영향은 있을 수 있으나 정확성·회귀 방지 가치 대비 비용이 낮고, 프로덕션 성능에는 영향이 없다.

## 위험도

NONE
