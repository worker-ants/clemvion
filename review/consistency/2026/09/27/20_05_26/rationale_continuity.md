# Rationale 연속성 검토 — `plan/in-progress/spec-draft-cross-workspace-refs.md`

## 발견사항

- **[INFO]** 자동 조립 컨텍스트 번들이 정작 이 draft 가 가장 많이 손대는 두 문서의 Rationale 을 예산 초과로 누락
  - target 위치: 없음 (검토 입력 자체의 한계)
  - 과거 결정 출처: 없음 — 이 발견은 target 문서가 아니라 본 검토에 주어진 `_prompts/rationale_continuity.md` 번들의 결함
  - 상세: 번들의 "관련 Rationale 발췌" 섹션이 `spec/data-flow/11-workflow.md`(원 3,287자)와 `spec/data-flow/12-workspace.md`(원 17,095자)를 "컨텍스트 예산 초과로 생략"으로 표시했다. 그런데 이 draft 의 변경 C1·E 는 정확히 이 두 문서의 Rationale/본문을 대상으로 한다 — 번들만 신뢰했다면 가장 관련성 높은 과거 결정(§"경로 파라미터 워크스페이스도 가드가 본다", §"멤버십 검증은 가드 1곳에서")을 보지 못한 채 판정했을 것이다. 저장소 메모(`feedback_consistency_spec_mode_budget`)가 이미 기록한 것과 같은 부류의 예산 누락이다.
  - 제안: 이번 검토는 해당 두 파일을 워크트리에서 직접 읽어 보완했다(아래 발견사항들이 그 결과). orchestrator 쪽에서 `--spec` 번들 예산 산정 시 target 의 `spec_impact` 프론트매터에 나열된 경로를 우선순위로 포함하는 것을 고려할 만하다.

- **[INFO]** 두 곳의 결정 번복 모두 새 Rationale 을 정상적으로 동반함 — 반증 절차 확인
  - target 위치: §C1 (`spec/data-flow/11-workflow.md` §1.2 각주 교체), §E (`spec/data-flow/12-workspace.md` `## Rationale` 새 절)
  - 과거 결정 출처: `spec/data-flow/11-workflow.md` §1.2 각주("저장 경로는 `container_id`/`tool_owner_id` 를 **검증 없이** 그대로 저장") — 실제 파일 237번째 줄 이후 Rationale 과 대조 완료
  - 상세: C1 은 "저장 시점 검증 없음"이라는 기존 계약 문장을 뒤집는다. 이것만 보면 "결정의 무근거 번복"(관점 3)에 해당할 수 있으나, target 은 같은 변경안 안에 `spec/data-flow/12-workspace.md` `## Rationale` 새 절(§E, "본문 참조 id 도 저장 전에 소속을 본다")을 **동반 작성**했고, 그 절이 재현 실측(A→B 워크플로 웹훅 201/202, 캔버스 저장 200)과 대안 기각 근거(왜 저장 시점인가·왜 새 `_NOT_FOUND` 코드를 안 만드는가·캔버스 저장 노드 id 재발급 대안 기각)를 모두 갖췄다. 이 저장소의 "결정 번복 시 새 Rationale 동반" 관행(예: `duplicate` 메타-only 서술 철회, §8.1 `change_summary` 자동생성 정정)과 형태가 같다.
  - 제안: 없음 — 정상 패턴. 참고로만 기록.

- **[INFO]** 신설 원칙이 기존에 기각된 대안의 논리를 정확히 재인용해 씀 — 모순 아님, 재확인만
  - target 위치: §E 세번째 불릿 "왜 저장 시점인가"
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` §"멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)" 의 "기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착"
  - 상세: target 은 "읽는 자리마다 필터를 기대하는 것은 위 절이 «74번째 라우트» 로 기각한 모양 그대로다"라고 인용해, 라우트별 opt-in 필터링을 반복 기각하는 이 저장소의 확립된 원칙(관점 2: 합의된 원칙)을 **위반이 아니라 연장 적용**하는 근거로 쓰고 있다. 인용된 원문(§"경로 파라미터 워크스페이스도 가드가 본다"의 "74번째 라우트 문제는 데코레이터로 안 닫힌다")과 대조해도 취지가 일치한다.
  - 제안: 없음.

- **[INFO]** `_NOT_FOUND` 코드 신설 금지 원칙 준수 확인
  - target 위치: target 본문 `## Rationale` 두번째 불릿, §A1 "거부 응답" 문단
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.11 (`AUTH_CONFIG_NOT_FOUND` 를 "이 저장소에서 유일한 예외"로 명시) — 실제 파일 244행 대조 완료
  - 상세: target 은 새 검증 실패마다 `WORKFLOW_NOT_FOUND` 류의 새 도메인 코드를 만들지 않고 기존 `VALIDATION_ERROR` + `details.field` 패턴을 재사용하며, 그 이유를 명시적으로 §1.11 을 인용해 적었다. 모델 설정 참조만 기존 `findEntity(id, workspaceId, kind)` 를 그대로 써서 404 `MODEL_CONFIG_NOT_FOUND` 를 내는 것도 실제 코드 관행과 일치(§1-data-model.md 확인).
  - 제안: 없음.

- **[INFO]** 실행 시점 격리(W-6)와의 층 구분이 정확함
  - target 위치: §E "실행 시점 격리와는 다른 층이다" 불릿
  - 과거 결정 출처: `spec/4-nodes/2-flow/1-workflow.md` §2 "W-6 워크스페이스 격리 guard" (`assertSameWorkspace` / `WORKFLOW_FORBIDDEN_WORKSPACE`)
  - 상세: W-6 은 **실행 중** Sub-Workflow 노드가 가리키는 워크플로우의 워크스페이스를 막는 별개 메커니즘이고, target 의 신설 규칙은 **저장 시점** 요청 본문(트리거·스케줄·캔버스 등)의 참조를 막는다. target 은 이 구분을 명시적으로 적어 W-6 을 무효화하거나 대체하는 것으로 오독될 여지를 스스로 차단했다. 실제 코드 위치·에러 코드 매핑도 W-6 문서와 대조해 어긋남이 없다.
  - 제안: 없음.

- **[INFO]** B5 정정이 실제 spec 문장과 정합함 — 번복이 아니라 spec↔code drift 교정
  - target 위치: §B5 (`spec/2-navigation/1-workflow-list.md` `## Rationale` §3 끝 정정 단락)
  - 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` §3.1 (`PATCH /api/folders/:id` 행: "**`parentId` 변경 시 create 와 동일한 계층 무결성 검증**: 새 부모가 같은 워크스페이스에 없거나…") 및 `## Rationale` §3 "폴더 계층 무결성은 생성·부모 변경 양쪽에서 강제 (2026-07-05)"
  - 상세: 기존 spec 은 PATCH 검증이 "create 와 동일"하다고 적어 CREATE 도 같은 워크스페이스 검사를 한다고 **암묵 전제**하고 있었다. `--impl-prep`(BLOCK:YES)이 밝힌 대로 실제 코드는 CREATE 에서 깊이만 검사했다. target 의 B5 는 이 gap 을 "정정" 단락으로 명시하고 근거(고치기 전 e2e 201, `getDepth` 가 타 워크스페이스 부모를 "없음"으로 읽어 깊이 1로 통과)를 남긴다 — 이는 §3 Rationale 이 세운 원칙(생성·부모변경 양쪽 강제)을 뒤집는 것이 아니라 그 원칙을 뒤늦게 실제로 이행하는 교정이다.
  - 제안: 없음 — 다만 B5 의 문구가 "이 결정 뒤에도"라고 표현해 §3 Rationale 자체가 틀렸다는 인상을 줄 수 있다. §3 Rationale 본문이 "종전 `update()`" 만 언급하고 create 코드 상태를 직접 진술하지 않으므로 엄밀히는 §3 Rationale 은 거짓이 아니라 불완전했던 것 — 정정 단락에 "§3 결정 자체는 유효하며, create 코드가 그 결정을 온전히 반영하지 못했던 부분만 닫는다"는 한 문장을 더하면 다음 독자가 §3 Rationale 전체를 의심하는 일을 막을 수 있다.

## 요약

target draft 는 `--impl-prep`(BLOCK: YES)이 지목한 두 문장(폴더 생성 워크스페이스 검증 누락, 캔버스 저장 무검증 각주)과 W1(Trigger 워크스페이스 대칭 제약 부재)을 데이터 모델 §1.1 한 자리로 통합해 닫는 설계다. 검토 범위 안에서 과거 Rationale 이 명시적으로 기각한 대안을 이유 없이 재도입한 사례, 합의된 설계 원칙(가드 무조건 검증·라우트별 opt-in 반복 기각·`_NOT_FOUND` 코드 신설 금지·W-6 실행시점 격리와의 층 분리)을 위반한 사례는 발견되지 않았다. 두 곳(`11-workflow.md` §1.2 각주, `1-workflow-list.md` §3 관련 gap)에서 기존 계약 서술을 뒤집지만, 두 곳 모두 재현 실측·대안 기각 근거를 갖춘 새 Rationale(§E 신설, §3 정정 단락)을 동반해 "무근거 번복" 기준에 해당하지 않는다. 다만 이번 검토에 주어진 컨텍스트 번들 자체가 예산 초과로 가장 관련성 높은 두 문서(`11-workflow.md`, `12-workspace.md`)의 Rationale 을 생략했다는 점은 검토 파이프라인의 구조적 위험으로 별도 기록해 둔다(이번 세션은 실제 spec 파일을 직접 읽어 보완했다).

## 위험도
NONE
