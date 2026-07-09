<!-- main 이 journal(wf_3dcc5db4-28c)에서 복원 — subagent write 격리. -->

### 발견사항

- **[WARNING]** phase 2 의 reconcile 방향 전환이 `data-flow/12-workspace.md`의 `## Rationale` 본문과 상충하게 되나, 이 파일이 spec-flip 추적 목록에서 누락됨
  - target 위치: `plan/in-progress/editor-slug-phase2.md` §"잠금된 결정"("reconcile 게이트: 에디터에도 동일 적용(URL=SoT, 정합 전 캔버스 렌더 gate)") 및 §S7("spec flip" 대상 파일 목록: `9-user-profile.md:158`·`_layout.md:85`·`0-dashboard.md:21`·`1-workflow-list.md:103`·`14-execution-history.md:20`·`3-workflow-editor/2-edge.md:10`)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` → "### URL slug = FE 라우팅 SoT (≠ backend 인가 SoT)" 절의 "reconcile 방향 = URL 우선" 항목 — "slug 없는 라우트(**에디터**·docs·catch-all)에서는 종전대로 localStorage 힌트 기준."
  - 상세: 이 문장은 `## Rationale` 섹션 안에서 에디터를 "slug 없는 라우트라 localStorage 힌트 기준 reconcile"의 예시로 명시적으로 못박고 있다. phase 2 plan은 정확히 그 반대(에디터도 URL-우선 reconcile 적용)를 잠금 결정으로 채택했으므로 이는 의도된 결정 번복이지만, 그 근거가 되는 이 문서·문장은 개발자가 추적 중인 S7 spec-flip 목록 6개 파일 어디에도 포함돼 있지 않다. 다른 5개 파일(모두 본문/Overview 서술)은 S7이 정확히 커버하는데, 유독 `## Rationale` 섹션 안에 박제된 이 invariant 서술만 누락된 상태 — 구현 후 이 문서를 고치지 않으면 시스템 핵심 invariant를 기술하는 SoT 문서 자체가 실제 동작과 모순되는 상태로 방치된다.
  - 제안: S7 목록에 `spec/data-flow/12-workspace.md` §"URL slug = FE 라우팅 SoT"의 "reconcile 방향 = URL 우선" 문단(에디터를 예시에서 제거하거나 "phase 2 이후 에디터도 URL 우선"으로 갱신)을 추가. project-planner에게 위임 시 `spec_impact`에 이 파일을 명시할 것.

- **[INFO]** `_layout.md` 내 동일 근거("에디터=phase 1 slug 밖")가 두 곳(§2.2 줄85, §3.1 줄126)에 있으나 S7은 한 곳만 명시
  - target 위치: `plan/in-progress/editor-slug-phase2.md` §S7 (`_layout.md:85`만 기재)
  - 과거 결정 출처: `spec/2-navigation/_layout.md` §2.2(줄85, 사이드바 메뉴 slug 예외 — "에디터 `/workflows/[id]`·인증 `(auth)` 도 동일")과 §3.1(줄126, 알림 딥링크 "`/workflows/<id>`(실패류)는 에디터 라우트라 phase 1 에서 slug 밖")
  - 상세: phase 2 plan의 잠금 결정("알림 딥링크는 기본 bare 유지 + catch-all 흡수, 저위험 현행")에 따르면 알림 링크의 *동작*은 그대로지만, 줄126의 *근거*("에디터 라우트라 slug 밖")는 phase 2 이후 사실이 아니게 된다(에디터는 이제 일반적으로 slug 라우트이며, 알림 링크만 별도로 bare 유지되는 의도적 예외로 바뀐다). S7이 줄85만 명시하면 구현 중 줄126을 놓쳐 같은 문서 안에 상충하는 서술이 남을 위험이 있다.
  - 제안: S7 항목을 `_layout.md:85, 126` 로 명확히 하고, 줄126의 문구를 "에디터 라우트라 slug 밖" → "알림 딥링크는 마이그레이션 범위 밖(의도적 저위험 보존)"으로 정정.

### 요약
target(`spec/2-navigation/` 현재 상태)과 phase 2 계획(`plan/in-progress/editor-slug-phase2.md`)을 phase 1에서 잠근 핵심 invariant(backend는 header-first `X-Workspace-Id`→토큰 클레임 모델 불변, URL slug는 FE 라우팅 SoT일 뿐 backend 인가 SoT가 아님, token-first는 #859로 이미 기각된 대안)와 대조한 결과, phase 2 plan은 이 invariant들을 정확히 계승하고 있으며 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 지점은 발견되지 않았다. 다만 에디터의 reconcile 방향(localStorage-우선 → URL-우선)을 의도적으로 뒤집는 결정이 `spec/data-flow/12-workspace.md`의 `## Rationale`에 박힌 정확한 서술과 충돌하게 되는데, 이 파일이 개발자가 추적 중인 spec-flip 목록(S7)에서 누락되어 있어 구현 후 해당 Rationale 문서가 stale/self-contradictory 상태로 남을 위험이 있다. 아울러 `_layout.md`의 동일 근거가 반복되는 두 지점 중 하나만 추적되고 있어 부분 수정 위험도 존재한다. 두 건 모두 행위 규약(behavior contract) 위반이 아니라 문서 완결성 갭이며, 이미 진행 중인 spec-flip 프로세스(§S7 + project-planner 위임)에 항목만 추가하면 해소 가능하다.

### 위험도
LOW