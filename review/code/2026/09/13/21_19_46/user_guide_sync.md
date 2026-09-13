# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — error-code-emission-axis (라운드 3, `21_19_46`)

## 검토 방법

`.claude/config/doc-sync-matrix.json` (rows 21개, id: `new-node` ~ `spec-defect-found`) 을 SSOT 로
Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인했다. 변경 파일 목록은
`git diff --name-only origin/main...HEAD` 로 실측(prompt 의 24개 파일 나열과 일치 확인) —
실질 코드/문서 변경은 8개뿐이고 나머지는 `review/**` 산출물이다:

- `CHANGELOG.md`, `PROJECT.md`
- `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `logic.en.mdx`
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`,
  `guide-identifier-scan.ts`
- `plan/in-progress/error-code-emission-axis.md`, `spec-draft-nullable-notation-followups.md`

**이전 라운드 확인**: 동일 브랜치의 `review/code/2026/09/13/19_51_33/user_guide_sync.md` 가 이미
같은 8개 실질 파일 집합(당시도 동일)에 대해 21개 행 전수를 검토해 위험도 NONE 으로 판정했다.
`19_51_33` 이후 라운드(`RESOLUTION.md` 기준 WARNING#1~#4 수정: `parseWhereRefs` 도입, 판정 함수
export, `staleEntries` 중복 제거, CHANGELOG 자기모순 문구 수정, bare 시각 인용 정정)는 전부
**가드 테스트·스캐너 내부 구현**과 **CHANGELOG 문구 정정**에 국한되며, `git diff --name-only`
로 확인한 실질 파일 집합 자체는 변하지 않았다 — 즉 이번 라운드에서 매트릭스 판정을 뒤집을
신규 trigger 후보(신규 `.tsx`, 신규 backend 노드, 신규 docs 섹션 디렉토리 등)가 추가되지 않았다.

## 개별 판단 (변경분 재확인)

- **new-node / node-schema-change** — `codebase/backend/src/nodes/**` 변경 0건. 미성립.
- **new-ui-string** — `.tsx` 변경 0건. 미성립.
- **new-warning-code / new-error-code** — 역방향 확인 재검증: `execution-engine.service.ts:7121,7125,7130`
  을 직접 열어 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가 `throw new Error(\`CODE: ...\`)`
  형태의 **메시지 문자열 접두**일 뿐 `ErrorCode` enum 멤버가 아님을 확인했다. `error-codes.ts`,
  `warningRules` 자체는 이 diff 에서 변경되지 않았으므로 `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO`
  동반 갱신 의무는 애초에 성립하지 않는다 — 매핑할 신규 enum 값이 없다.
  `grep -rn "CONTAINER_MISSING_EMIT\|CONTAINER_MULTIPLE_EMIT" codebase/frontend/src/lib/i18n/` 결과
  0건으로, dict/backend-labels 어느 쪽도 이 토큰을 다루고 있지 않으며 다뤄야 할 근거도 없다.
- **userguide-gui-flow-section** (`02-nodes/**.mdx`, semantic) — `logic.mdx`/`logic.en.mdx` 가 glob
  후보이나, 파일 전체에 `<ImplAnchor>` 가 0개(재확인: `grep -n "ImplAnchor" logic.mdx` 무매치)이고
  `triggers-coverage.test.ts`/`integrations-coverage.test.ts` 의 검사 대상도 `02-nodes/triggers.mdx`·
  `06-integrations-and-config/`로 한정돼 `logic.mdx` 는 대상 밖이다. 변경 내용도 기존
  `<Callout type="warn">` 문장 정정(오류 서술 → 정확한 서술)이지 신규 GUI 흐름 절이 아니다. 미해당.
- **KO/EN 가이드 문장 parity** — `logic.mdx:114`(KO)·`logic.en.mdx:103`(EN) 두 문장이 같은 diff
  안에서 동일한 의미로 함께 수정됐다(재확인: 위 grep 결과 두 파일 모두 갱신됨, 한쪽만 남은 사례
  없음).
- **new-userguide-section-dir / integration-provider-change / new-widget-chrome-string /
  auth-*-change / expression-language-change / run-debug-flow-change / new-bullmq-queue /
  env-runtime-change / spec-major-change** — 트리거 전제(backend 소스 변경, 신규 섹션 디렉토리,
  `.tsx`, `spec/2-5-*`·`spec/conventions/**` 변경) 자체가 이 diff 에 없음. 전부 미성립.
- **spec-defect-found** — 이번 라운드에서 새로 추가된 실질 코드 변경은 없고(가드 내부 리팩터링 +
  CHANGELOG 문구 정정), spec 6파일과의 불일치는 이미 `spec-draft-nullable-notation-followups.md`
  에 등재돼 있다는 이전 판단이 그대로 유지된다(이번 라운드에서 등재 위치가 바뀌지 않음).

## 발견사항

- 없음 — 매트릭스 21개 행 중 어느 것도 "누락된 동반 갱신"을 가리키지 않는다.

## 요약

이번 라운드(`21_19_46`)의 diff 는 이전 라운드(`19_51_33`) 대비 실질 파일 집합이 동일하고, 추가된
변경은 가드 테스트/스캐너 내부 구현 정리(`parseWhereRefs`·판정 함수 export·`staleEntries`)와
CHANGELOG 자기모순 문구 정정뿐이다. 매트릭스 21개 trigger 를 전수 재확인한 결과 매칭 후보는
"userguide-gui-flow-section" 1건(실측 결과 `logic.mdx` 는 ImplAnchor 대상 파일이 아니라 미해당)
뿐이며, KO/EN 가이드 문장은 같은 diff 안에서 함께 정정돼 parity 문제가 없고, 문제의 두 식별자
(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`)는 구조화된 error/warning code 가 아니어서
`backend-labels.ts` 동반 갱신 의무도 성립하지 않는다. 확정 누락 = 0.

## 위험도

NONE
