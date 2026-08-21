# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14 (최종본, 12_25_15)

## 검토 방법

`origin/main...HEAD` 3커밋(`7cc64fa35` 추출 본체 → `bf0618a7d` 라운드1 WARNING 3건 처분 →
`1f63bbbef` 라운드2 WARNING 3건 처분) 누적 diff 69개 파일을 대상으로,
`plan/in-progress/masked-marker-shared-package.md` 가 선언한 단일 목표("`MASKED_MARKERS`/
`isMaskedMarker`/깊이 상한의 backend↔frontend 중복을 `@workflow/masked-markers` 공유 패키지로
추출한다")와 대조했다. 프롬프트가 크기 제한으로 생략한 파일(양쪽 `masked-marker-mirror-guard.ts`,
frontend `masked-marker-mirror.test.ts`, `plan/in-progress/masked-marker-shared-package.md`,
`pnpm-lock.yaml`)은 `git diff origin/main...HEAD -- <path>` 로 직접 원본을 열어 확인했다.

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 에 목표와 무관한 `eslint-config-next` peer-dependency 재해석이 섞여 있다 (기존 지적의 지속 확인)
  - 위치: `pnpm-lock.yaml` — `snapshots:` 섹션의 `eslint-config-next@16.3.0(...)`/`eslint-import-resolver-typescript@...`/`eslint-module-utils@...`/`eslint-plugin-import@...` 네 항목 (게이트 없는 대량 재구성 구간이라 파일 내용으로 특정)
  - 상세: `@workflow/masked-markers` workspace 패키지 신설로 `pnpm install` 이 의존 그래프를 재계산하면서, `eslint-config-next` 의 peer-dependency variant 가 이전엔 `(@typescript-eslint/parser@8.67.0(...))` 를 포함한 것과 포함하지 않은 것 두 갈래였다가 하나로 dedup 됐다. `git diff origin/main...HEAD -- pnpm-lock.yaml` 로 직접 대조한 결과 이 재구성 외에 `masked-markers` 와 무관한 다른 패키지 버전 변경은 없다 — 전량 `eslint-config-next` 관련 4개 snapshot 키뿐. 버전 자체는 불변이라 기능 영향은 없다. 이 항목은 라운드1(`11_27_29/scope.md`)·라운드2(`11_53_49/scope.md`)·라운드2 dependency 리뷰에서 이미 동일하게 식별·불요 판정됐고, 이번 최종 diff 에서도 동일한 형태로 남아 있어 새로 악화되지 않았다.
  - 제안: 조치 불필요(불가피한 `pnpm install` 부산물, 3라운드 연속 동일 판정). PR 설명에 "이 lockfile 재정렬은 신규 패키지 추가의 부수 효과" 한 줄을 남기면 리뷰 노이즈를 줄일 수 있다.

- **[INFO]** 커밋되는 consistency 리뷰 산출물 하나에 sub-agent 의 중간 추론 텍스트가 그대로 섞여 남아 있다
  - 위치: `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1`, `:3`
  - 상세: 파일 최상단에 `"Confirmed accurate — this matches the target's table exactly..."`(1행), `"Based on this extensive verification, I have sufficient grounds for my findings."`(3행) 두 문장이 `## 발견사항` 앞에 그대로 남아 있다(직접 `Read` 로 재확인). 이는 target 코드의 스코프 판단과는 무관하고, 이 PR 이 CLAUDE.md 규약에 따라 커밋하는 리뷰 산출물(`review/consistency/**`) 자체의 생성 후처리 흠이다. 라운드1 scope 리뷰(`11_27_29/scope.md` INFO 2)가 이미 동일하게 지적했으나 이번 최종 diff 까지 그대로 남아 있다.
  - 제안: 이 PR 의 스코프 판단에는 영향 없음. 다음 consistency-check 실행 시 정리되면 충분하고, 지금 되돌리려 손대면 오히려 이미 완결된 리뷰 이력을 편집하는 새로운 변경이 된다.

## 스코프 내로 확인한 항목 (참고 — 문제 없음)

- **핵심 추출**(`codebase/packages/masked-markers/**` 신설 · backend `sanitize-error-message.ts` / frontend `masked-markers.ts` 의 재export 전환)은 plan 문서의 "무엇을 옮기나" 표와 값·시그니처까지 1:1 대응한다. `git diff` 로 직접 대조한 결과 마커 리터럴 3종·`isMaskedMarker` 시그니처·깊이 상한(10)은 이관 전후 완전히 동일하다.
- **등록 표면 8곳**(`test-stages.sh`, `packages-checks.yml` pathspec/matrix/주석 카운트 5→6, 두 `package.json`, 세 Dockerfile COPY, `pnpm-lock.yaml`)은 plan 이 실측해 미리 표로 열거한 것과 정확히 대응하며, 무관한 기존 패키지 항목은 건드리지 않았다.
- **신규 미러 소멸 가드**(backend `masked-marker-mirror-guard.ts`/`.spec.ts`, frontend 동명 파일 + `.test.ts`)는 plan 의 "미러 소멸 캐너리" 작업 항목의 집행이며, 새 기능 확장이 아니다. 두 사본이 구조적으로 판박이인 것은 `11_27_29` WARNING 1(경로 게이팅 사각지대)의 명시적 처분 결과다.
- **라운드1·라운드2 수정분** — 없애려던 CI 경로 게이팅을 가드 배치로 재도입했던 것(backend 사본 신설), 세 번째 스택(`channel-web-chat`)이 무방비였던 것(`frontend-checks.yml` pathspec 확장), 감시 목록(`SOT_SYMBOLS`/`SCAN_DIRS`) 자체가 손 목록 미러였던 것(패키지 export/디렉터리 실측 파생으로 전환) — 전부 CLAUDE.md 가 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"로 규정한 같은 턴 WARNING 처분이지 새로운 요청 없는 확장이 아니다. 각 RESOLUTION.md 가 근거를 명시한다.
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`** diff 는 `:373`·`:757` 두 트래커 항목만 `[x]` + 대체 근거로 정정하며 다른 항목은 건드리지 않는다.
- **`spec/5-system/14-external-interaction-api.md`** 편집(frontmatter `code:` 1줄 + R17 SoT 문장)은 plan 문서가 "spec R17 정정" 작업 항목으로 명시적으로 선언한 대로이고, `developer` 의 `spec/` read-only 제약을 우회한 것이 아니라 `RESOLUTION.md` WARNING 3(라운드1)이 선례(`eia-context-schema-followups.md` "가드/코드 변경에 동반되는 SoT 표 sync 는 developer 가 `--impl-done` 검증과 함께 수행 가능")를 인용해 명시적으로 결정한 경로다. `plan/in-progress/masked-marker-shared-package.md` 자체의 체크리스트도 이 항목이 이미 `[x]` 로 반영돼 있어(신규 파일이라 최종 상태로 커밋됨), 라운드2 scope 리뷰(`11_53_49/scope.md` WARNING)가 지적했던 "plan 체크박스가 실제 상태를 반영 못 함" 문제는 최종 diff 에서 해소됐다.
- **신규 패키지 보일러플레이트**(`package.json`/`tsconfig.json`/`eslint.config.mjs`/`README.md`)는 기존 `@workflow/ai-end-reason` 등 형제 패키지와 동일한 틀이며 과잉 설정이 없다.
- **`review/code/2026/08/21/{11_27_29,11_53_49}/**`·`review/consistency/2026/08/21/{10_45_52,10_58_25}/**`** 산출물 일체는 CLAUDE.md 가 강제하는 구현 완료 후 `/ai-review` + 사전 `/consistency-check` 워크플로의 표준 부산물이며(`review/` 는 gitignore 대상이 아니고 SoT 로 남긴다는 프로젝트 관례), 코드 변경과 무관한 별건 작업이 아니다.

## 요약

이 PR 은 "마스킹 마커 계약을 공유 패키지로 추출한다"는 단일 목표에 3라운드에 걸쳐서도 일관되게 수렴한다. 라운드1·라운드2의 수정분은 전부 그 라운드 리뷰가 지적한 WARNING 의 최소 처분이지, 요청받지 않은 기능 확장이나 무관한 리팩터가 아니다 — 이는 CLAUDE.md 가 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"로 명시한 절차와 정확히 일치한다. 등록 8곳·재export shim 유지·미러 소멸 캐너리·트래커 정정·spec R17 편집 전부가 plan 문서가 사전에 실측·명시한 항목과 diff 가 1:1 대응하며, 라운드2에서 지적됐던 "plan 체크박스 stale" WARNING 도 최종 diff(신규 파일 상태)에서는 이미 `[x]` 로 해소돼 있다. 남은 두 건은 모두 INFO 수준으로 3라운드 연속 동일하게 판정된 `pnpm-lock.yaml` 의 불가피한 peer-dep 재해석 노이즈와, 코드 스코프와 무관한 리뷰 산출물(`rationale_continuity.md`) 안의 sub-agent 잔여 텍스트뿐이며 둘 다 target 코드의 실질 변경이 아니다.

## 위험도
LOW
