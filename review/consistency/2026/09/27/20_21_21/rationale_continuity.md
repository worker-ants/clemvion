# Rationale 연속성 검토 — `spec/2-navigation/` (`--impl-prep`, cross-workspace-refs)

## 발견사항

- **[INFO]** 컨텍스트 번들이 `4-integration.md`(168,023자) 하나로 예산을 소진해 2-navigation 하위 15개 파일 본문이 통째로 생략됨
  - target 위치: `_prompts/rationale_continuity.md` 조립 결과 — `4-integration.md` · `6-config.md` · `9-user-profile.md` · `14-execution-history.md` · `_product-overview.md` · `5-knowledge-base.md` · `8-marketplace.md` · `0-dashboard.md` · `7-statistics.md` · `10-auth-flow.md` · `11-error-empty-states.md` · `13-user-guide.md` · `15-system-status.md` · `16-agent-memory.md` · `_layout.md`
  - 과거 결정 출처: 저장소 메모 `feedback_consistency_spec_mode_budget` — "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다" 와 동일 부류의 예산 누락이 이번 `--impl-prep` 번들에서도 재발
  - 상세: 이번 spec 변경(`spec/1-data-model.md` §1.1 신설)은 `authConfigId`(→ `6-config.md`) · `embeddingModelConfigId` 등(→ `5-knowledge-base.md`) · 워크스페이스 slug 라우팅(→ `9-user-profile.md`)을 명시적으로 언급하는데, 정작 이 세 파일이 번들에서 생략됐다. 번들만 신뢰했다면 이 파일들의 Rationale 이 §1.1 과 충돌하는지 확인할 수 없었다. 이번 검토는 해당 파일들을 워크트리에서 직접 읽어 보완했다(`5-knowledge-base.md` R-1~R-3, `6-config.md` R-1~R-7) — 충돌 사례는 발견되지 않았다(아래 요약).
  - 제안: 이전 검토(`review/consistency/2026/09/27/20_05_26/rationale_continuity.md`)가 이미 낸 제안과 동일 — `--spec`/`--impl-prep` 번들 예산 산정 시 target 의 `spec_impact` 나열 경로를 우선 포함하거나, 단일 거대 파일(`4-integration.md`)이 같은 디렉터리의 작은 파일들 예산까지 잠식하지 않도록 파일별 상한을 둘 만하다.

- **[INFO]** 핵심 변경(§1.1 신설)은 기존 원칙을 위반이 아니라 연장 적용 — 재확인
  - target 위치: `spec/data-flow/12-workspace.md` `## Rationale` "본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)"
  - 과거 결정 출처: 같은 문서 "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)" 의 "기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착"
  - 상세: 신설 절은 "읽는 자리마다 필터를 기대하는 것은 위 «멤버십 검증은 가드 1곳에서» 가 «74번째 라우트» 로 기각한 모양 그대로다" 라고 인용해, 라우트별 opt-in 검증을 반복 기각해 온 이 저장소의 확립 원칙을 저장 시점 검증이라는 새 표면에 그대로 연장한다. 인용이 원문 취지와 어긋나지 않는다(대조 완료).
  - 제안: 없음 — `review/consistency/2026/09/27/20_05_26/rationale_continuity.md` 의 동일 발견을 재확인.

- **[INFO]** 두 곳의 기존 계약 서술 번복 모두 새 Rationale 을 동반 — 무근거 번복 아님
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3 Rationale "(2026-09-27 정정)" 단락, `spec/data-flow/11-workflow.md` §1.2 각주 교체
  - 과거 결정 출처: `1-workflow-list.md` `## Rationale` §3 "폴더 계층 무결성은 생성·부모 변경 양쪽에서 강제 (2026-07-05)" / `data-flow/11-workflow.md` §1.2 각주("저장 경로는 검증 없이 그대로 저장")
  - 상세: 두 곳 모두 과거 계약 서술을 뒤집지만, 재현 실측(고치기 전 e2e 201/200, `plan/complete/cross-workspace-refs.md` 인용)과 새 규칙의 출처(`spec/1-data-model.md` §1.1)를 명시해 "결정의 무근거 번복"(점검 관점 3)에 해당하지 않는다. 이 판정은 20_05_26 검토와 동일하며, 이번 세션에서 재확인했다.
  - 제안: (경미, 재기록) `1-workflow-list.md` §3 정정 단락의 "이 결정 뒤에도 **생성** 경로는 깊이만 봤다" 문구는 §3 Rationale 원 결정 자체가 틀렸다는 인상을 줄 수 있다. "§3 결정 자체는 유효하며 create 코드가 그 결정을 온전히 반영하지 못했던 부분만 닫는다" 는 한 문장을 추가하면 다음 독자의 오독을 막는다 — 20_05_26 검토가 이미 제안했으나 아직 반영되지 않았다. 차단 사유는 아니다.

- **[INFO]** 인접 도메인(Integration 소유권)의 "부재·타인 것을 구분하지 않는다" 원칙과 정합 — 응답 코드만 도메인별로 다름
  - target 위치: `spec/2-navigation/4-integration.md` `## Rationale` "Personal 통합 소유자 강제 — 404 존재 은닉 · 역할 우위 없음 · 노드 실행은 후속 (2026-09-25)"
  - 과거 결정 출처: `spec/1-data-model.md` §1.1 "없는 id 와 남의 id 를 구분하지 않는다" / `spec/data-flow/12-workspace.md` "경로 파라미터 워크스페이스도 가드가 본다"
  - 상세: Integration 문서 스스로 "«권한 없음과 부재를 같은 응답으로 묶는다» 원칙은 경로 파라미터 워크스페이스 가드와 같다 … 원칙은 같고 상태 코드는 도메인마다 다르다" 라고 명시해, §1.1 이 세 번째로 같은 원칙을 재사용하는 흐름과 충돌하지 않는다. 이 문서는 번들에서 생략돼 직접 읽어 대조했다.
  - 제안: 없음.

## 요약

`spec/2-navigation/` 범위에서 검토한 결과, target 이 기존 spec `## Rationale` 이 명시적으로 기각한 대안을 이유 없이 재도입하거나, 확립된 설계 원칙(가드 무조건 검증·라우트별 opt-in 반복 기각·`_NOT_FOUND` 코드 신설 금지·부재/타인 것 미구분·W-6 실행시점 격리와의 층 분리)을 위반한 사례는 발견되지 않았다. `1-workflow-list.md` §3 과 `data-flow/11-workflow.md` §1.2 두 곳에서 기존 계약 서술을 뒤집지만 모두 재현 실측과 근거를 갖춘 새/정정 Rationale 을 동반해 "무근거 번복" 기준에 해당하지 않으며, 이는 이 PR 의 이전 `--spec` 단계 검토(`review/consistency/2026/09/27/20_05_26/rationale_continuity.md`, 위험도 NONE)와 일치하는 결론이다. 다만 이번 `--impl-prep` 번들도 거대 파일(`4-integration.md`) 하나가 예산을 독식해 `6-config.md`·`5-knowledge-base.md`·`9-user-profile.md` 등 §1.1 이 직접 언급하는 파일들의 본문을 포함한 15개 파일이 생략되는 구조적 문제가 재발했다 — 이번 세션은 해당 파일을 직접 읽어 충돌 없음을 확인했으나, 파이프라인 차원의 예산 배분 개선은 여전히 남은 과제다.

## 위험도
NONE
