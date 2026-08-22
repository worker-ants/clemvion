# Rationale 연속성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 검토 범위·방법

- diff 범위(`origin/main...HEAD`): `spec/4-nodes/7-trigger/1-manual-trigger.md` · `spec/5-system/{3-error-handling,12-webhook,13-replay-rerun,14-external-interaction-api}.md` · `spec/conventions/error-codes.md` · 대응 backend/docs-site 코드·CHANGELOG.
- 핵심 변경: Manual 세 경로(`POST /workflows/:id/execute`·`POST /workflows/:id/save`·`POST /executions/:id/re-run`)의 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일 — re-run 경로만 쓰던 `INVALID_INPUT` 을 폐지.
- 대상 spec 의 `## Rationale`·인접 원칙 서술과 diff 를 대조. `git -C <worktree>` 로 `origin/main` 대비 실제 반영분을 절대경로로 재확인(HEAD 워킹트리가 SoT).
- 직전 라운드 산출물(`review/consistency/.../16_34_50/rationale_continuity.md`, `review/code/.../17_32_01/*`)을 대조해 이미 처리된 항목과 신규 항목을 구분.

## 발견사항

- **[WARNING] `error-codes.md §5` 도입부·하단 Rationale 의 "전 행 공통 확인" 서술이 신규 행과 문자 그대로 충돌**
  - target 위치: `spec/conventions/error-codes.md` §5 도입 문단("그럼에도 아래 코드는 **소비자가 자사 클라이언트뿐**… breaking 영향이 없음을 **확인한 뒤** 교체했다… **외부 client 코드에 분기로 노출된 적이 없다**")과 하단 `## Rationale` 불릿 "§5 진입 기준이 'client 코드 분기 미존재' 인 이유"(§5 는 "노출 0" 이 아니라 "**client 분기 0**" 을 흡수 조건으로 삼는다 — 하드코딩 분기가 있으면 §5 가 아니라 §3/§4 신설 또는 정식 마이그레이션)
  - 과거 결정 출처: 같은 문서 `spec/conventions/error-codes.md §5`(§2 rename=breaking 정책에 대한 명시적 예외 통로 — 이 PR 이전부터 존재하던 문구, diff 로 손대지 않음) + `## Rationale` 하단 불릿(마찬가지로 diff 밖, 기존 문구 그대로)
  - 상세: 이번 diff 가 §5 표에 신설한 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 행 자체는 스스로 "본 표에서 리스크 등급이 가장 높은 행" 이라 명시하고, 판정 근거를 "부재 **확인**" 이 아니라 "관측(grep) 범위에서 **미발견**" 이라 적는다 — 즉 "저장소 밖 서드파티가 이 값으로 분기했을 가능성을 **코드로 배제할 수 없다**" 고 스스로 인정한다. 그런데 이 행이 들어간 §5 섹션의 **도입 문단**과 하단 **`## Rationale` 불릿**은 diff 로 전혀 수정되지 않아, 여전히 "아래 코드(표의 모든 행)는 breaking 영향이 없음을 **확인**했다" · "외부 client 코드에 분기로 노출된 적이 **없다**" 라는 절대적 문장을 유지한다. 하단 불릿은 한 걸음 더 나아가 §5 진입을 이분법(**client 분기 0** → §5 흡수 / **하드코딩 분기 존재** → §5 대신 §3·§4 신설 또는 정식 마이그레이션)으로 명문화하는데, "관측 범위에서 미발견(=확인 불가)" 이라는 제3의 상태는 이 이분법 어디에도 없다. 결과적으로 새 행은 §5 자신이 선언한 진입 조건(확인된 zero-risk)을 충족하지 못한 채로, 그 조건을 "완화"하는 절차(원칙문 개정·새 카테고리 신설) 없이 §5 표에 조용히 흡수됐다 — 행 안의 캐비엇("이후 이 표를 '공개 API 든 rename 안전' 으로 일반화하지 말 것")이 사실상 §5 원칙문이 해야 할 일(진입 기준 재정의)을 대신하고 있다. 이는 "합의된 원칙 위반"(§5 admission 기준을 실제로는 충족하지 않은 채 편입)이자 "암묵적 가정 충돌"(섹션 헤더가 여전히 "확인됨" 을 invariant 로 전제)에 해당한다. 다만 리스크 자체(breaking change, 제3자 영향 가능성)는 이미 CHANGELOG·§5 행·code-review(`17_32_01` MEDIUM)에서 명시적으로 인지·인수됐고, 은폐된 결정 번복은 아니다 — 흠은 원칙문 텍스트가 그 인수를 반영하도록 갱신되지 않았다는 점 하나다.
  - 제안: (a) §5 도입 문단을 "아래 코드는 **원칙적으로** 소비자가 자사 클라이언트뿐임을 확인한 뒤 교체했다(단, 워크스페이스 JWT 로 호출 가능한 내부 REST 엔드포인트처럼 저장소 밖 호출자를 완전히 배제할 수 없는 경우는 리스크를 명시하고 사용자 결정으로 잔여 위험을 인수한 뒤 등재한다)" 식으로 완화하거나, (b) 하단 `## Rationale` 불릿의 이분법에 세 번째 갈래("관측 범위 내 미발견 + 사용자 결정으로 잔여위험 인수 — §5 흡수하되 행에 리스크 등급 명시")를 추가해 신규 행이 실제로 어떤 갈래를 탔는지 원칙 수준에서 설명한다. 둘 다 새 텍스트를 요구하지 않고 기존 두 문단을 한두 문장만 확장하면 된다.

- **[INFO] `#TBD_PR` placeholder — Rationale 연속성 자체엔 영향 없으나 §5 이력 추적성 저하**
  - target 위치: `spec/conventions/error-codes.md:145` §5 신규 행 "PR" 열
  - 상세: 기존 3행(PR4b·PR4b·#566)은 전부 추적 가능한 식별자를 갖는데 반해 신규 행만 `#TBD_PR` 이다. §5 의 목적이 "rename 배경 **추적용** 이력" 임을 감안하면 병합 전 실제 PR 번호로 치환이 필요하나, 이는 이미 직전 code-review(`17_32_01` documentation W2/R11)에서 발견·계획(PR 생성 직후 치환)까지 확인된 사안이라 본 리뷰에서 별도 조치 요구 없음.

- **[INFO] 나머지 결정 번복은 전부 이력·근거를 갖춘 정상 패턴**
  - `3-error-handling.md` §1.3 의 "RERUN_ prefix 를 붙이지 않는 것은 의도" 기존 문구를 폐기하지 않고, 그 문구가 실제로 기각했던 것("`RERUN_INVALID_INPUT` 로의 개명")과 결정하지 않았던 것("세 경로 통일 여부")을 명시적으로 구분한 뒤 후자만 새로 결정 — 과거 Rationale 을 무시하지 않고 정확히 재해석한 모범 사례.
  - `error-codes.md §4` → §4.1/§4.2 분리는 새 원칙 도입이 아니라 기존에 "착지하지 않던" cross-reference(webhook §5.2·error-handling §1.3 가 가리키던 "§4 패턴")를 실제로 착지시키는 drift 정정.
  - 마커 재제출 거부를 base(`resolveTriggerParameters`)가 아닌 wrapper(`resolveTriggerParametersRejectingMasked`)에 두는 설계는 이번 diff 이전(#1188~#1190)에 이미 확립된 결정이며, 이번 diff 는 그 결정을 재해석·재도입 없이 문서 참조만 보강했다.
  - 직전 라운드(`16_34_50`)가 지적한 "§5 선례 3건도 같은 한계에서 같은 판단을 내렸다" 는 소급 서술 왜곡은 이번 diff 의 최종 문구("이 행은 본 표에서 리스크 등급이 가장 높다… 이후 이 표를 일반화하지 말 것")로 해소됐다 — 과거 3건과 신규 1건을 동일시하지 않고 명시적으로 구분했다.

## 요약

이번 diff 는 Manual 세 경로의 `error.code` 통일이라는, 과거 `3-error-handling.md` 의 명시적 결정("RERUN_ prefix 미부여는 의도")을 부분적으로 뒤집는 변경이지만, 그 결정이 실제로 무엇을 기각했는지를 정확히 재확인하고 새 Rationale(행 단위 캐비엇 + `error-codes.md §5` 신규 행 + `CHANGELOG.md` breaking 고지)을 갖춰 처리했다 — "결정의 무근거 번복" 이나 "기각된 대안의 재도입" 은 발견되지 않았다. 유일한 흠은 그 새 행이 스스로 인정하는 "확인 아닌 미발견" 이라는 낮은 확신도가, 같은 섹션의 도입 문단·하단 Rationale 불릿이 여전히 선언하는 "client 분기 0 확인" 이라는 절대적 admission 기준과 텍스트 상 정합되지 않는다는 점이다 — 업무적 위험 자체는 이미 code-review 라운드에서 MEDIUM 으로 인지·인수됐으므로, 본 발견은 그 인수를 원칙 문서 수준에서 명문화하라는 문서 정합 보완 요구에 가깝다.

## 위험도

LOW
