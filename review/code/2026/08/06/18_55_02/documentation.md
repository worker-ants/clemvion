# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 새 `prepare` 스크립트 계약이 담긴 문서(테스트 docstring/README)로의 포인터가 `package.json` 자체에는 없음
  - 위치: `codebase/packages/ai-end-reason/package.json:9`, `codebase/packages/chat-channel-validation/package.json:9`, `codebase/packages/expression-engine/package.json:9`, `codebase/packages/graph-warning-rules/package.json:9`, `codebase/packages/node-summary/package.json:9`, `codebase/packages/sdk/package.json:9`, `codebase/packages/web-chat-sdk/package.json:12` (모두 `"prepare"` 필드)
  - 상세: 7개 `package.json` 에 동일한 ~290자 `node -e "..."` 한 줄이 손으로 복사돼 들어갔다. 이 계약("모든 패키지의 prepare 는 byte-identical 이어야 한다")과 배경(2026-04-29 npm 워크어라운드, pnpm 전환 후에도 backend Dockerfile 의 pruned tree 케이스가 남아있는 이유)은 `.claude/tests/test_packages_prepare_contract.py` 모듈 docstring 과 `.claude/tests/README.md` 표에 잘 정리돼 있지만, `package.json` 을 직접 여는 사람(예: 신규 패키지 스캐폴딩, 또는 이 줄만 손으로 고치려는 사람)은 그 문서의 존재를 알 길이 없다. JSON 은 주석을 지원하지 않지만, 바로 같은 diff 의 `web-chat-sdk/package.json` 이 이미 `"//name"`, `"//dependencies"` 형태의 pseudo-comment 키 관례를 쓰고 있다 — 같은 패턴(`"//prepare"`)으로 "byte-identical 계약, 편집 전 test_packages_prepare_contract.py 확인" 정도의 짧은 포인터를 남기면 이 갭을 no-cost 로 메울 수 있다. 실제 위반은 `test_every_package_that_builds_uses_the_same_prepare` 가 CI 에서 잡아주므로 위험도는 낮다(발견이 늦어질 뿐, 놓치지는 않는다).
  - 제안: 7개 파일 중 하나(또는 전부)에 `"//prepare": "byte-identical across codebase/packages/* — see .claude/tests/test_packages_prepare_contract.py before editing"` 같은 pseudo-comment 키 추가를 검토.

## 요약

이번 변경은 문서화 측면에서 이례적으로 탄탄하다: 신규 테스트 파일(`test_packages_prepare_contract.py`)의 모듈 docstring 이 버그 실측·과거 워크어라운드 배경·3갈래 계약 표를 모두 기록하고, `.claude/tests/README.md` 표 행이 그 내용과 사실관계가 일치하며, `harness-checks.yml` 에 추가된 `codebase/packages/*/package.json` 트리거에도 왜 필요한지("매니페스트만 고친 PR 에서 가드가 안 돌면 stale dist 를 되살리는 한 줄이 조용히 들어온다")를 설명하는 인라인 주석이 붙었다. 오래된 주석·README·CHANGELOG(제품/spec 연동 변경만 다루는 이 저장소의 관례상 harness 변경은 범위 밖) 쪽에서 갱신 누락은 발견되지 않았다. 유일한 지적은 7개 `package.json` 에 손으로 복제된 복잡한 `prepare` 한 줄에 문서 포인터가 없다는 INFO 수준 제안뿐이다.

## 위험도

LOW
