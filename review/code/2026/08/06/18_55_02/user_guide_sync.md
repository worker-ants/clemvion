# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

없음 — 이번 변경 set 은 매트릭스 어떤 trigger 에도 실질적으로 매칭되지 않는다.

### 참고 (INFO, 비차단) — `expression-engine/package.json` 은 glob 상 기술적 매치이나 semantic 판정으로 배제

- **[INFO]** `codebase/packages/expression-engine/package.json` 이 doc-sync-matrix 의 `expression-language-change` 행 glob(`codebase/packages/expression-engine/**`) 에 형태상 걸린다.
  - 변경 파일: `codebase/packages/expression-engine/package.json`
  - 매트릭스 항목: `expression-language-change` (표현식 언어 변경) — targets: `codebase/frontend/src/content/docs/04-expression-language/{basics,variables-and-context,cheatsheet}.mdx + .en.mdx`. trigger.match 는 `"semantic"` 이라 glob 매치만으로 자동 확정되지 않고 reviewer 판단이 필요.
  - 실제 diff: `scripts.prepare` 필드 하나만 `"[ -d dist ] || tsc"` → typescript 존재 여부를 확인하는 `node -e "..."` 로 교체. 파서/평가기(`src/**`)는 이 diff 에 전혀 포함되지 않았고, 표현식 언어의 문법·함수·변수 바인딩 등 사용자 가시 동작은 아무것도 바뀌지 않았다.
  - 결론: 이는 patch #944 계열의 다른 8개 `codebase/packages/*/package.json` 변경과 동일한, **`prepare` 빌드 스크립트 계약 통일**(harness CI 백스톱, `.claude/tests/test_packages_prepare_contract.py` 신설)일 뿐이다. `04-expression-language/*.mdx` 갱신 의무 없음 — false-positive glob 매치로 판단해 배제.

## 변경 set 요약

리뷰 대상 10개 파일 전부 harness/CI 인프라 계층이다:
- `.claude/tests/README.md` — 신규 harness 테스트 카탈로그 행 추가 (harness 자체 문서, product 유저 가이드 아님)
- `.claude/tests/test_packages_prepare_contract.py` (신규) — `codebase/packages/*/package.json` 의 `prepare` 스크립트 계약을 검증하는 harness 단위테스트
- `.github/workflows/harness-checks.yml` — CI `paths:` 에 `codebase/packages/*/package.json` glob 추가
- `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` — `prepare` 스크립트를 `[ -d dist ] || tsc` (디렉터리 존재만 확인) 에서 typescript 가용성을 실제로 검사하는 3분기 로직으로 교체

이 중 어느 것도 다음 어느 것도 건드리지 않는다:
- `codebase/backend/src/nodes/**` (신규/변경 노드) — 미해당
- `codebase/frontend/src/**/*.tsx` (신규 UI 문자열) — 미해당
- `codebase/backend/src/modules/auth/**` (인증·세션 흐름) — 미해당
- `codebase/backend/src/nodes/core/error-codes.ts` / warningRules 소스 (`graph-warning-rules/src/**`) — `graph-warning-rules/package.json` 만 변경됐고 그 안의 룰 소스 자체는 변경 없음
- `codebase/frontend/src/content/docs/*/` 신규 섹션 디렉토리 — 미해당
- backend 실행/디버깅 엔진 — 미해당

매트릭스 21개 행(JSON `rows[]`) 중 glob 상 매치된 것은 `expression-language-change` 1건뿐이며, 위에서 판단했듯 실질 내용(파서/평가기 소스 无변경, 빌드 스크립트만 변경)이 semantic trigger 를 충족하지 않아 INFO 로 배제. 동반 갱신 누락은 0건.

## 위험도

NONE
