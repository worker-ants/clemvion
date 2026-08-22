# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 이번 변경분은 순수 문서(spec/plan/review) 변경으로, 의존성 관점에서 점검할 대상이 없다.
  - 위치: 전체 24개 파일 (`plan/in-progress/spec-draft-egress-masking-convention.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/consistency/2026/08/22/**` 다수, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`, `spec/conventions/egress-masking.md`(신설), `spec/conventions/node-output.md`)
  - 상세: 24개 파일 전부가 `.md`(spec/plan/consistency 리포트) 또는 `.json`(`_retry_state.json`, `meta.json` — consistency-checker 진행 상태 파일) 이다. `package.json`, lockfile(`pnpm-lock.yaml`), `import`/`require` 구문을 포함한 소스 코드 파일은 diff 에 포함되지 않았다. 새 외부 패키지 추가, 버전 변경, 라이선스 이슈, 취약점, 번들 크기, 빌드 시간 영향 — 이 리뷰 관점의 항목 1~7 은 전부 해당 사항 없음(N/A).
  - 제안: 없음.

- **[INFO]** 신설 `spec/conventions/egress-masking.md` 의 `code:` frontmatter 가 선언하는 6개 내부 코드 의존 경로는 전부 실재를 확인했다.
  - 위치: `spec/conventions/egress-masking.md:4-10` (frontmatter `code:` 목록)
  - 상세: `codebase/packages/masked-markers/src/index.ts`, `codebase/backend/src/shared/utils/sanitize-error-message.ts`, `codebase/backend/src/shared/utils/strip-external-only-fields.ts`, `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`, `codebase/frontend/src/lib/utils/masked-markers.ts` 6개 파일 모두 워크트리에 존재함을 `ls` 로 직접 확인했다. `spec-code-paths.test.ts` 가 검사하는 "SoT 문서 → 코드 파일" 내부 의존 매핑에 깨진 참조(dangling reference)가 없다.
  - 제안: 없음 (이미 정합).

- **[INFO]** 문서가 스스로 명시한 "내부 의존성" 구조(관점 8) — 신설 convention 문서가 3개 spec 문서의 참조 허브가 됨.
  - 위치: `spec/5-system/14-external-interaction-api.md` R17 절 상단 콜아웃(`spec/conventions/egress-masking.md` 링크 추가), `spec/5-system/6-websocket-protocol.md` §4.1 근방 불릿(동일 링크 추가), `spec/conventions/node-output.md` 선택적 echo 절 상단(동일 링크 추가)
  - 상세: `plan/in-progress/spec-draft-egress-masking-convention.md` 의 Rationale 이 밝히듯, 세 상한(`MAX_MASK_DEPTH`/`MAX_SANITIZE_DEPTH`/`stripExternalOnlyFields` 호출부 인자)을 하나로 합치지 않기로 한 기존 코드 결정(`masked-markers/src/index.ts` JSDoc: "별개 불변식이므로 합치지 않는다 — 공유 프리미티브를 넓히면 무관한 경로가 오염된다")을 그대로 존중하며, 그 대신 문서 레이어에서만 좌표계를 단일 SoT 로 모았다. 이는 코드 의존성 그래프를 바꾸지 않고 spec 문서 간 참조 그래프만 정리한 것으로, 순환 참조나 소유권 충돌 없이 EIA §R17(정책)·WS §4.1(WS 전용 불변식)·node-output.md(echo 규칙)가 각자 영역을 유지한 채 egress-masking.md(좌표계)를 단방향으로 가리키는 트리 구조다.
  - 제안: 없음 (구조상 문제 없음, 참고용 기록).

## 요약

이번 diff 는 `spec/`·`plan/`·`review/` 아래의 마크다운·JSON 문서만으로 구성된 순수 문서 변경(신설 spec convention 문서 승격 + 관련 트래커/consistency-review 산출물)이며, `package.json`·lockfile·소스 코드 import 등 실제 의존성 표면을 전혀 건드리지 않는다. 따라서 새 의존성 추가, 버전 고정, 라이선스, 취약점, 불필요한 의존성, 번들 크기, 외부 호환성 항목은 모두 해당 사항이 없다. 유일하게 관련 있는 관점(8. 내부 의존성)에서도, 신설 `spec/conventions/egress-masking.md` 가 선언한 6개 코드 파일 참조가 전부 실재함을 확인했고, 세 개의 상위 spec 문서(EIA §R17·WS §4.1·node-output.md)가 이 신설 문서를 단방향으로 참조하는 구조가 기존 "상한을 합치지 않는다"는 코드 결정과 정합적으로 유지된다. 의존성 관점에서 이 변경을 차단할 이유는 없다.

## 위험도
NONE
