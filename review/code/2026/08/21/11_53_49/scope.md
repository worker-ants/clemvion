# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14 (라운드2, WARNING 수정 반영본)

## 검토 방법

target 은 `plan/in-progress/masked-marker-shared-package.md` 가 선언한 단일 목표("backend↔frontend
마커 상수·판정 로직·깊이 상한 중복을 `@workflow/masked-markers` 공유 패키지로 추출")에 더해, 직전
코드 리뷰(`review/code/2026/08/21/11_27_29`)의 WARNING 3건 수정분(`bf0618a7d`)까지 포함한 누적 diff
(53개 변경 파일)다. 각 파일을 plan 의 "작업" 체크리스트·"등록 표면 실측 8곳" 표와 대조했고, 특히
직전 라운드에서는 diff 에 없었던 `spec/` 편집이 이번 라운드에 새로 추가됐으므로 그 정합성을
plan 문서·CLAUDE.md 역할 경계와 대조해 별도로 확인했다.

## 발견사항

- **[WARNING]** `spec/` 편집이 실행됐는데, 같은 PR 의 plan 문서 자신이 그 항목을 "planner 턴
  필요"로 명시하고 아직 미체크(`[ ]`) 상태로 남겨 둔 채다 — 선언된 스코프와 실제 diff 가 어긋난다
  - 위치: `spec/5-system/14-external-interaction-api.md:13`-`16`(frontmatter `code:` 목록에
    `codebase/packages/masked-markers/src/index.ts` 추가) 및 `:1622`-`1631`(R17 "마커 집합은
    backend `sanitize-error-message.ts` 가 SoT" 문장을 "SoT 는 공유 패키지" 로 교체) — 커밋
    `bf0618a7d`. 대조 대상: `plan/in-progress/masked-marker-shared-package.md:127`
    (`Read` 로 직접 확인한 실제 줄 번호) — `- [ ] **spec R17 정정 (planner 턴 필요)** — ...
    developer 는 `spec/` read-only 라 planner 턴으로 분리 집행` 이 **여전히 미체크**로 남아 있다.
  - 상세: CLAUDE.md 는 "developer 는 `codebase/**`, `plan/**`, `review/**/RESOLUTION.md` 만 쓰고
    `spec/` 은 read-only" 라고 명시하고, "구현 중 spec 변경 필요 시 developer 는 멈추고
    project-planner 위임" 이라 규정한다. plan 문서 자신도 이 규칙을 그대로 옮겨 적어 이 항목을
    미체크로 남겨 뒀다. 그런데 실제로는 `review/code/2026/08/21/11_27_29/RESOLUTION.md`
    "WARNING 3" 처분으로 developer 가 `spec/` 을 직접 편집했고, 근거로 `plan/in-progress/
    eia-context-schema-followups.md:56` 의 선례("가드/코드 변경에 **동반되는 SoT 표 sync**(신규
    요구·결정을 담지 않는 정합화)는 developer 가 `--impl-done` 검증과 함께 수행 가능")를 인용해
    별도 `--spec` 라운드 대신 `--impl-done` 으로 검증했다고 적었다. 이 판단 자체는
    `review/consistency/2026/08/21/10_45_52/plan_coherence.md` 의 사전 권고와도 일치하고, 편집
    내용도 "새 요구·결정" 이 아니라 이미 코드에서 일어난 이관을 그대로 반영하는 SoT 서술 정정이라
    선례의 범주("정합화")에 부합해 보인다. 다만 **문제는 편집의 정당성이 아니라 plan 문서 자체가
    갱신되지 않았다는 점**이다 — 체크리스트가 "developer 는 못 한다" 고 적어 둔 항목이 실제로는
    developer 자신에 의해 수행됐는데, 그 사실이 plan 본문 어디에도 반영(체크 완료 + 대체 근거)되지
    않아 plan 을 읽는 제3자는 "이 항목은 아직 planner 턴을 기다리는 중" 이라고 오독하게 된다. 같은
    PR 이 바로 아래(`:133`, 트래커 `:373`·`:757` 항목)에서는 "완료 시 대체 근거를 남긴다" 는 원칙을
    정확히 지켰는데(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 두 항목 모두
    `[x]` + 인용된 선례로 정정됨), 정작 자기 자신의 spec 편집 항목에는 같은 원칙을 적용하지 않았다.
  - 제안: `plan/in-progress/masked-marker-shared-package.md:127` 체크리스트 항목을 `[x]` 로
    바꾸고, "실제로는 `--impl-done` 검증 + `eia-context-schema-followups.md` 선례로 developer 가
    직접 수행했다(정합화 범주, 신규 결정 없음)" 는 대체 근거를 그 자리에 남긴다 — 트래커 두 항목에
    적용한 것과 동일한 패턴.

- **[INFO]** `pnpm-lock.yaml` 에 이번 PR 의도(마커 공유 패키지 추출)와 무관한 `eslint-config-next`
  peer-dependency 해석 트리 재정렬이 여전히 섞여 있다
  - 위치: `pnpm-lock.yaml` (게이트 없는 대규모 재구성 구간 — 정확한 파일 줄 번호 대신 내용으로
    특정: `eslint-config-next@16.3.0` 의 `eslint-import-resolver-typescript`/`eslint-module-utils`/
    `eslint-plugin-import` peer 서명 괄호 체인)
  - 상세: 직전 라운드 scope 리뷰(`review/code/2026/08/21/11_27_29/scope.md` INFO 1)가 이미
    지적한 것과 동일한 성격의 잔여 노이즈로, `codebase/packages/masked-markers` 신설에 따른
    `pnpm install` 재해석의 불가피한 부산물로 보인다(버전 자체는 불변). 이번 라운드에서 새로
    악화되지 않았다.
  - 제안: 조치 불필요 — 직전 라운드와 동일 판정 유지. 리뷰 시 diff 노이즈로 인지만 해 둘 것.

## 스코프 내로 확인한 항목 (참고 — 문제 없음)

- **`bf0618a7d` 의 나머지 변경**(backend 신규 미러 가드 2파일 · frontend 가드/테스트에 접두 겹침
  캐너리 1건씩 추가 · 패키지 spec 의 리터럴 pin 강화)은 전부 직전 코드 리뷰 SUMMARY 의 WARNING
  1·2 를 그대로 처분한 것이고, `RESOLUTION.md` 가 근거를 남겼다. 새 기능 확장이 아니라 지적된
  결함의 최소 수정이다.
- **backend `src/repo-guards/__tests__/masked-marker-mirror-guard.ts`/`.spec.ts`(신규)** 는
  frontend 동명 파일의 판박이 사본으로, 두 워크플로 pathspec 게이팅을 모두 커버하려는 명시적
  설계 결정(WARNING 1 처분)이며 plan 의 목표(추출이 되돌려지지 않는지 감시)를 벗어나지 않는다.
- **등록 8곳·재export shim 유지·`spec-sync-external-interaction-api-gaps.md` 트래커 2항목
  정정**은 직전 라운드 scope 리뷰가 이미 "스코프 내"로 확인했고 이번 라운드에서도 그 형태가
  바뀌지 않았다.
- **`review/code/2026/08/21/11_27_29/**`·`review/consistency/2026/08/21/{10_45_52,10_58_25}/**`
  산출물 일체**는 CLAUDE.md 가 강제하는 리뷰/일관성 검토 산출물 저장 위치 규약을 따르는 표준
  프로세스 부산물이며, 코드 변경과 무관한 별건 작업이 아니다.

## 요약

이번 diff 는 여전히 "마스킹 마커 계약을 공유 패키지로 추출한다"는 단일 목표에 대체로 타이트하게
수렴하며, 직전 라운드 WARNING 3건의 수정분도 지적된 범위를 벗어나지 않는다. 다만 그 수정 중
하나(spec R17 SoT 서술 정정)가 실제로 `spec/` 파일을 편집했는데, 이 편집이 같은 PR 의 plan
문서 자신이 "developer 는 `spec/` read-only 라 planner 턴 필요" 라고 명시하며 미체크로 남겨 둔
바로 그 항목이다. 편집 내용 자체는 기존 선례(SoT sync 는 `--impl-done` 검증과 함께 developer
수행 가능)에 부합해 보이나, plan 문서가 그 결정과 실행 사실을 반영하도록 갱신되지 않아 "선언된
스코프"와 "실제 diff" 사이에 정합 공백이 남았다. `pnpm-lock.yaml` 의 무관한 peer-dep 재정렬은
직전 라운드와 동일한 INFO 로 유지된다.

## 위험도

MEDIUM
