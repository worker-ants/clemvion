### 발견사항

- **[INFO]** 이번 변경 범위는 `spec/**`·`review/consistency/**` 뿐이며 `codebase/**` 의 실제 애플리케이션 코드·테스트 코드는 전혀 포함되지 않음
  - 위치: 전체 diff (파일 1~35)
  - 상세: 35개 변경 파일이 모두 markdown/json 문서(spec 본문 수정, consistency-check 산출물)이고, `*.spec.ts`/`*.test.ts` 는 diff 대상에 없다. 따라서 "신규 코드에 대한 테스트 추가 필요성" 관점에서는 해당 사항이 없다. 다만 문서가 인용하는 기존 회귀 테스트(`cafe24-token-refresh.processor.spec.ts` TEST-C2, `catalog-sync.spec.ts`, `spec-link-integrity.test.ts` 등)의 실존·주장 정합성은 실측 확인했다: `TEST-C2`(L224-238)는 실제로 `refreshAccessToken` throw 시 `process()` 가 `rejects.toBe(refreshError)` 로 propagate 하는지 검증하고 있어, `spec/2-navigation/4-integration.md` §10.5/§Rationale 이 인용한 "re-throw invariant, TEST-C2 로 회귀 고정" 서술과 정확히 일치한다. `catalog-sync.spec.ts` 도 `cafe24`/`makeshop` 양쪽 metadata 디렉토리에 실존해 485-endpoint 수치 주장의 근거가 hallucination 이 아님을 확인했다. 이는 좋은 관행 — 신규 spec 서술을 만들 때 기존 회귀 테스트를 SoT 로 명시 인용해 "문서가 코드와 어긋나면 test 가 잡는다"는 연결고리를 만든 것이다.
  - 제안: 조치 불요(양호 사례로 기록).

- **[WARNING]** 문서 prose 에 수치(485/128/161 등)를 여러 파일에 리터럴로 반복 삽입하면서, 이 값들의 상호 정합을 강제하는 자동 테스트/가드가 없음 — 바로 이번 PR 이 고치려는 "~180 화석" drift 를 재생산할 구조적 위험
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md`(L29,L446), `spec/4-nodes/3-ai/0-common.md`(L63), `spec/4-nodes/3-ai/1-ai-agent.md`(L333), `spec/5-system/11-mcp-client.md`(§5.8), `spec/0-overview.md`(§Cafe24/MakeShop 행), `spec/2-navigation/4-integration.md`(§14.2) — 총 7곳 이상에 "485"/"128" 리터럴이 반복 하드코딩됨
  - 상세: 첨부된 `review/consistency/**` 산출물(cross_spec.md, rationale_continuity.md 등) 자신이 이미 지적했듯, 이번 정정이 커버하는 4곳(`4-cafe24.md` 2곳) 밖에 "~180" 잔존 인스턴스가 최소 2곳(`2-navigation/4-integration.md:1110`, `4-nodes/3-ai/0-common.md:63` — 단, 첨부 diff 상으로는 `0-common.md:63` 은 실제로 D3 범위에서 "485"로 정정된 것으로 보이나 `2-navigation/4-integration.md:1110` 은 리뷰 대상 diff 에 포함되지 않음) 확인됐다. `catalog-sync.spec.ts` 는 카탈로그 markdown ↔ 백엔드 metadata 간의 코드 레벨 정합만 강제할 뿐, **spec prose 안의 리터럴 수치 중복**을 검증하는 테스트/가드는 저장소 어디에도 없다(cross_spec.md, rationale_continuity.md 가 동일하게 명시). 즉 다음 카탈로그 규모 변경(신규 endpoint 추가 등) 시, 이번에 여러 파일에 심어진 "485" 리터럴들이 개별적으로 다시 stale 화되어도 이를 잡을 CI 게이트가 없다 — 이는 "정확 수치는 근사치(~)보다 눈에 띄지만 고칠 지점은 더 많다"는 rationale_continuity.md 자신의 우려와 일치한다.
  - 제안: (a) 최소한으로, `spec/conventions/cafe24-api-catalog/_overview.md` §5 Coverage Matrix 를 단일 SoT 로 두고 다른 spec 문서는 리터럴 대신 링크 인용으로 낮추는 방향을 검토. (b) 테스트 관점에서 더 근본적으로는, `catalog-sync.spec.ts` 또는 신규 `spec-prose-consistency.test.ts` 류에 "spec/**.md 전체에서 특정 정규식(예: 구 fossil 패턴 `~180`, `~10 operation`)이 더 이상 존재하지 않아야 한다" 같은 저비용 grep 기반 가드를 추가하면, 이런 종류의 수치 drift 가 재발해도 사람이 매 세션 consistency-check 를 돌리기 전에 CI 가 먼저 잡는다.

- **[INFO]** `spec-impl-evidence.md` 가드 표 서술 정정(파일 35)이, "문서가 서술하는 테스트/가드 동작"과 "실제 테스트 코드의 동작"이 자동 검증 없이 괴리될 수 있음을 보여주는 사례
  - 위치: `spec/conventions/spec-impl-evidence.md` §4 가드 표, `spec-link-integrity.test.ts` 행 (L125)
  - 상세: 이번 diff 는 "spec 문서가 `plan/**` 를 가리키는 링크는 plan-coherence-checker 담당이라 `spec-link-integrity.test.ts` 검증 대상에서 제외된다"는 종전 서술이 실제 테스트 동작과 반대였음을 바로잡는다("spec 본문 스캔에는 target 필터가 없어 plan/** 링크도 검증 대상"). 즉 문서가 테스트의 동작을 잘못 설명한 상태가 상당 기간 발견되지 않았다는 뜻이다 — 이 괴리를 잡아낸 것은 자동화된 doc-vs-test 정합성 검사가 아니라 이번 consistency-check 세션의 수동(LLM) 코드 대조였다. 테스트 스위트 자체는 정상 동작해왔으므로(빌드는 실제로 plan 이동 시 이 링크가 정정되지 않았으면 깨졌을 것) CRITICAL 은 아니지만, "가드 설명 문서 ↔ 가드 구현" 간에는 여전히 자동 정합성 체크가 없다.
  - 제안: 조치 불요(이미 이번 diff 로 정정됨). 다만 향후 유사 서술 오기를 조기에 잡으려면, `spec-impl-evidence.md` §4 표의 각 가드 설명 옆에 해당 테스트 파일의 핵심 assertion 라인 앵커를 링크해 두는 관행을 권장(선택 사항, 이번 범위 밖).

- **[WARNING]** consistency-check 파이프라인 자체의 FS-write flakiness — sub-agent 가 `status: success` 를 보고했지만 `output_file` 이 디스크에 생성되지 않는 실패 모드가 이번에도 재현됐고, 이를 잡는 자동 검증(파일 존재 확인)이 오케스트레이터 상태 머신에 내장되어 있지 않음
  - 위치: `review/consistency/2026/07/17/00_35_59/_retry_state.json`(`agents_success` 에 `rationale_continuity` 포함되지만 해당 output_file 은 최초 미생성), `review/consistency/2026/07/17/00_35_59/SUMMARY.md` L224("status=success 로 보고됐으나 output_file 이 실제로 생성되지 않아... 내용 미확보")
  - 상세: `.claude/docs/subagent-call-contract.md` 의 STATUS 라인 규약을 신뢰할 수 없는 사례다 — sub-agent 가 성공을 자보고해도 실제 산출물(output_file) 존재는 별도로 검증돼야 한다는 것을 이 사례 자체가 증명한다. 이번엔 `_retry_state.json` 의 `_final_state_note` 로 "workflow journal 에서 원문 복구"했다고 기록돼 있어 최종적으로는 복구됐으나, 이는 사람(orchestrator)이 수동으로 `ls` 대조 후 알아챈 결과이지 파이프라인 자체의 자동 검증 단계가 아니다 — 이는 MEMORY.md 에도 이미 알려진 패턴("Consistency/ai-review Workflow FS-write flakiness")으로 재발이 반복되고 있다.
  - 제안: 이 리뷰 대상 diff 범위 밖(오케스트레이션 스크립트 변경 없음)이라 이번 PR 에서 직접 조치할 필요는 없으나, `.claude/skills/consistency-checker/scripts/` 의 오케스트레이터에 "agents_success 등재 시 output_file 실제 존재를 함께 검증"하는 로직을 후속 과제로 제안한다(테스트 관점에서는 "성공 보고를 신뢰하지 말고 산출물 존재로 검증"이라는 일반 원칙의 적용).

- **[INFO]** 다수 consistency-check 산출물(`cross_spec.md`, `rationale_continuity.md`, `plan_coherence.md` 등)에 "실측 확인", "grep 확인", "코드 대조" 라는 표현이 반복되지만 실제 명령·출력이 함께 기록되지 않아 재현 가능한 증거로서는 약함
  - 위치: 전체 review/consistency/** 산출물 다수 지점(예: cross_spec.md L437 "grep 결과 `~180`/`카테고리당 평균 ~10`이 spec 전체에 정확히 4곳 존재")
  - 상세: 이 자체는 테스트 코드가 아니라 감사 산출물이므로 "테스트 가독성"이 직접 적용되진 않지만, 유사한 논리로 봤을 때 이런 서술형 주장은 매 세션 재실행해야만 재검증 가능하다 — 즉 "테스트"가 아니라 "일회성 수동 점검 로그"에 가깝다. 이번 리뷰에서 직접 `find`/`grep` 로 `catalog-sync.spec.ts`·`TEST-C2`·가드 테스트 파일들의 실존을 재확인해 hallucination 이 없음을 검증했으나, 매번 이렇게 재확인하지 않으면 신뢰가 순전히 sub-agent 자기보고에 의존하게 된다.
  - 제안: 필수는 아님. 장기적으로 checker 산출물에 실행한 grep/find 명령과 raw 출력을 코드블록으로 동봉하는 관행을 도입하면 재현성이 높아진다(비차단, 향후 검토).

### 요약

이번 변경분은 `codebase/**` 의 실제 애플리케이션 코드나 테스트 코드를 전혀 건드리지 않는 순수 spec/문서·리뷰 산출물 변경이라, 전통적 unit/integration/e2e 테스트 존재 여부·mock 적절성·테스트 격리 같은 관점은 대부분 해당 사항이 없다. 다만 두 가지 테스트 인접 리스크가 발견됐다: (1) 새로 여러 spec 파일에 리터럴로 반복 삽입된 수치(Cafe24 485, count-max 128 등)의 상호 정합을 강제하는 자동 테스트/가드가 없어, 이번 PR 이 고치려는 "~180 화석" drift 패턴이 새 위치에서 재발할 구조적 위험이 있다(checker 자신들도 미수정 잔존 인스턴스 2곳을 이미 지적함). (2) consistency-check 오케스트레이션의 known FS-write flakiness(성공 보고 vs 실제 산출물 부재) 가 이번 세션에서도 재현돼, "성공 보고를 신뢰하지 말고 산출물로 검증하라"는 테스트 원칙이 파이프라인 자체에는 아직 자동화되어 있지 않음을 보여준다. 반대로 긍정적인 부분은, 신규 spec 서술(예: `cafe24-token-refresh` re-throw 정책)이 기존 회귀 테스트(TEST-C2)를 명시 인용해 문서-테스트 연결고리를 만들었고, 이 인용이 실제 테스트 코드와 정확히 일치함을 직접 확인했다는 점이다.

### 위험도
LOW