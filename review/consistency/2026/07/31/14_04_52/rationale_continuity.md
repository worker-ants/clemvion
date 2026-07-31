# Rationale 연속성 검토 — spec-workflow-version-snapshot-drift

## 발견사항

Critical / Warning 없음. INFO 2건.

- **[INFO]** 정정 방향의 근거가 되는 corroborating source 를 과소 인용
  - target 위치: `plan/in-progress/spec-workflow-version-snapshot-drift.md` Overview 비교표(§0) 및 "2. 왜 data-flow 가 아니라 data-model 을 고치는가" ("셋 중 둘(코드·data-flow)이 일치하고 data-model 만 어긋난다")
  - 과거 결정 출처: `spec/3-workflow-editor/5-version-history.md` §7.2(`VersionSnapshot` TS 인터페이스: `name`/`description`/`nodes`/`edges` 만, `settings` 없음) · §8(`workflow_version` 테이블 정의, `snapshot: jsonb — 위 스키마`)
  - 상세: 실측 결과 target 이 언급한 "코드·data-flow" 외에 `5-version-history.md` 도 이미 동일하게 "settings 제외"를 정확히 반영하고 있다(직접 Read 로 확인). 즉 실제로는 코드·data-flow·version-history 셋이 모두 일치하고 data-model.md 하나만 어긋난 상태다. 이 문서를 놓쳤다고 해서 target 의 결론(정정 방향)이 바뀌지는 않으며 오히려 결론을 더 강하게 뒷받침하지만, target 의 근거 서술이 실제보다 약하게(2/3 tie-break 처럼) 제시되어 있다.
  - 제안: Overview 비교표에 `spec/3-workflow-editor/5-version-history.md §7.2` 행을 추가하거나, §2 문장을 "코드·data-flow·version-history 셋이 일치"로 갱신. 선택사항 — target 의 spec 변경안(TO-BE) 자체는 수정 불필요.

- **[INFO]** data-model.md 자체 `## Rationale` 절에 대응 stub 부재
  - target 위치: `plan/in-progress/spec-workflow-version-snapshot-drift.md` §1.1 TO-BE (data-model.md §2.15 표 행 정정만 제안, `## Rationale` 절 갱신 없음)
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` 의 "install_token 형식" 항목 — 같은 문서 안에서 body 표의 세부 사항을 한 줄로 요약하고 "상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale ...]" 로 외부 SoT 를 가리키는 선례가 존재.
  - 상세: target 은 TO-BE 표 행 안에 인라인 링크로 data-flow Rationale 을 가리키는 방식을 택했고, 이는 "결정의 배경·근거는 spec 문서 끝의 `## Rationale`" 원칙과 "중복 서술을 늘리지 않는다"는 target 자신의 §2 설명에 부합한다. 다만 같은 문서의 install_token 선례는 body 요약 + 자체 `## Rationale` 스텁 + 외부 링크의 3단 구조라, 이번 건은 로컬 스텁이 빠진 점만 다르다. 결정을 뒤집는 것도 새 결정을 만드는 것도 아니므로 필수는 아니다.
  - 제안: (선택) `spec/1-data-model.md` `## Rationale` 에 "WorkflowVersion.snapshot 구성 정정 (2026-07-31)" 한 줄 스텁을 추가해 "data-flow Rationale '버전 스냅샷 = JSONB' 참조, 상세는 그쪽" 을 명시하면 이후 재drift 발생 시 더 빨리 잡힌다. 하지 않아도 무방.

## 요약

target 의 핵심 주장 — `spec/data-flow/11-workflow.md` §Rationale "버전 스냅샷 = JSONB" 가 `workflow.settings` 를 명시적으로 스냅샷 대상에서 제외하고 있다는 인용 — 을 해당 spec 파일을 직접 Read 로 대조한 결과 문구까지 정확히 일치함을 확인했다(지어낸 Rationale 아님). `git log -S`/`git show` 로 이력을 추적한 결과, data-model.md §2.15 의 "nodes, edges, settings" 문구는 최초 PRD/spec 일괄 초안 커밋(`05089d5a6`, 2026-03-26)에서 작성된 이후 한 번도 갱신되지 않은 반면, data-flow 쪽의 "settings 제외" Rationale 은 이후의 spec↔code 전수 감사 커밋(`db496a3c2`, 2026-06-10)에서 코드 관찰에 근거해 의도적으로 정정됐고, 같은 커밋이 data-model.md 의 다른 5곳은 고치면서 §2.15 행만 놓쳤다 — 즉 이번 target 은 "결정의 번복"이 아니라 6월 감사에서 누락된 후속 정정을 완결하는 성격이다. `codebase/backend/src/modules/workflows/workflows.service.ts` 의 `buildSnapshot()` 실측(name/description/nodes/edges 4키, settings 없음)과 제3의 spec(`spec/3-workflow-editor/5-version-history.md` §7.2/§8, `VersionSnapshot` 인터페이스)도 모두 data-flow 편을 들어, "코드에 settings 를 추가하는" 반대 방향이야말로 data-flow Rationale 이 기록한 설계 결정을 뒤집는 셈이라는 target §2/§Rationale 의 판단은 근거가 탄탄하다. target 자신의 `## Rationale` 절도 "왜 이 방향인가"와 "왜 반대 방향은 대상이 아닌가"를 명시적으로 서술해, 기각된 대안 재도입 방지·원칙 준수·근거 있는 번복이라는 4개 점검 관점 모두에서 위반이 관측되지 않았다. 위 INFO 2건은 근거 서술을 더 강화하는 선택적 보완일 뿐 target 의 spec 변경안(TO-BE) 자체를 수정할 필요는 없다.

## 위험도
NONE
