# Rationale 연속성 검토 — spec/2-navigation/ (--impl-prep)

## 발견사항

- **[WARNING] `1-workflow-list.md` §2.3 "상태" 필터 행이 이미 해소된 불일치를 진행 중으로 서술 — 같은 절 하단과 자기모순**
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.3 필터 표 "상태" 행 (`⚠️ 현재 클라이언트는 서버 계약과 어긋난 파라미터를 보낸다 — 아래 경고 참고`) vs 바로 다음 인용문 (`> 상태 필터는 서버 계약(query-workflow.dto.ts)·클라이언트(page.tsx) 모두 ?status=active|inactive 로 정렬되어 end-to-end 동작한다 (과거 클라이언트가 ?isActive= 를 보내던 불일치는 수정 완료).`)
  - 과거 결정 출처: 이 항목은 새로 발견한 것이 아니라, `plan/complete/patch-omit-undefined.md`의 `--impl-prep`(`review/consistency/2026/09/27/13_11_33`)에서 **checker `rationale_continuity` 자신**이 이미 "W3"으로 지적한 항목이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 6338~6339행에 planner 백로그 항목 (8)로 등재되어 있다: "`1-workflow-list.md` §2.3 필터 표 «상태» 행이 이미 해소된 파라미터 불일치(#519)를 진행 중으로 적는다 — 같은 절 하단 보강 문구와 자기모순이다. 행의 경고를 걷는다."
  - 상세: 표 행은 "현재(현재형)" 클라이언트가 서버 계약과 어긋난 파라미터를 보낸다고 경고하지만, 바로 아래 문단은 그 불일치가 "과거"의 것이며 이미 수정 완료됐다고 명시한다. 두 문장이 같은 절 안에서 서로 다른 시제로 같은 사실을 반대로 진술한다 — 이 문서만 읽는 구현자는 `?isActive=` 계열 파라미터 불일치가 아직 살아있다고 오판해, 이미 끝난 수정을 다시 시도하거나 신뢰할 수 없는 spec으로 판단할 위험이 있다.
  - 이 상태는 (a) planner가 아직 처리하지 않은 **미해결 tracked 항목**이고, (b) 현재 in-progress plan(`patch-body-followups.md`, `spec_impact: none`)의 변경 범위(workflows/nodes/auth-configs DTO의 nullable 선언)는 이 파일을 건드리지 않으므로 **이번 PR이 만든 회귀는 아니다** — 다만 review scope가 `spec/2-navigation/`으로 넓게 잡혀 있어 여전히 관측된다.
  - 제안: 새 조치를 만들 필요 없음 — 기존 tracker 항목 (8)의 처방("행의 경고를 걷는다")을 planner 턴에서 그대로 집행하면 된다. 이번 developer PR의 `--impl-done`/`--impl-prep`에서 이 항목 때문에 BLOCK할 근거는 없다(기존 해소 방향이 이미 문서화돼 있고, 이 PR의 diff와 무관).

- **[INFO] PATCH tri-state 원칙(§5.4)이 `1-workflow-list.md`/`6-config.md`에는 명문화돼 있지 않음**
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3 API 표의 `PATCH /api/workflows/:id` 행(설명만 있고 tri-state 서술 없음)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 상단 박스("요청 바디는 대상이 아니다 — PATCH 부분 업데이트는 키 생략(=값 불변)·null(=초기화)·값(=설정)의 tri-state가 각각 의미를 갖는다")가 원칙의 SoT이고, `spec/2-navigation/2-trigger-list.md` §3 註는 이를 상세히 미러링하는 반면 `1-workflow-list.md`·`6-config.md`는 아직 이를 반영하지 않는다.
  - 상세: 이 gap은 Rationale의 원칙을 "위반"하는 설계가 아니라 **명문화 누락**이며, `plan/in-progress/spec-draft-nullable-notation-followups.md`의 같은 planner 항목 (7)에 이미 등재돼 있다("PATCH의 «키 생략=값 불변»(§5.4 tri-state)이 `2-trigger-list.md` §3 註에만 있고 `1-workflow-list.md` §3.2(워크플로·settings)·`6-config.md`에는 없다"). `patch-omit-undefined` PR이 코드 동작은 이미 그 원칙에 맞춰 놓았으므로(워크플로 `settings: {}`는 no-op), 남은 것은 순수 문서 갱신이다.
  - 제안: 새 항목 아님 — 기존 planner 항목 (7)이 처리 시 `1-workflow-list.md` §3.2와 `6-config.md`에 한 문장씩 추가하면 해소된다. 이번 developer PR 범위 밖.

## 요약

review scope로 넘어온 `spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`(및 예산 초과로 생략된 15개 파일의 frontmatter/제목만) 를 대상으로, 이 영역과 `1-data-model.md`·`0-overview.md`·`3-workflow-editor/*` 등에 걸친 관련 Rationale 발췌를 대조했다. 기각된 대안의 재도입, 합의 원칙의 직접 위반, 근거 없는 결정 번복 사례는 발견되지 않았다 — 오히려 각 spec의 Rationale(R-1~R-17, §Rationale 각 항목)은 자신의 본문과 정합적으로 교차 참조되어 있고, `patch-body-followups` 작업이 적용하려는 nullable 선언 방식(`@ApiPropertyOptional({ nullable: true }) + T | null`)은 §5.4가 이미 명시한 요청 DTO 선례(`UpdateAssistantSessionDto.llmConfigId`)를 그대로 따르는 것이라 원칙 위반이 아니다. 다만 `1-workflow-list.md` §2.3의 "상태" 필터 행은 이 checker 자신이 직전 PR(`patch-omit-undefined`)의 `--impl-prep`에서 이미 지적한 자기모순을 아직 안고 있다 — 미해결 상태로 tracker에 등재돼 있을 뿐 현재 target 문서에는 여전히 남아 있으므로 WARNING으로 재확인한다. 이 항목은 이번 developer PR(`patch-body-followups`)의 diff와는 무관한 pre-existing drift이며 planner 백로그로 이미 라우팅돼 있어, 이번 PR을 막을 근거는 아니다. 참고로 `spec/2-navigation/` 15개 파일과 `5-system/*` 다수가 컨텍스트 예산 초과로 프롬프트에서 생략됐다는 점은 이 bundle만으로는 전 영역의 continuity를 완전히 보증할 수 없다는 한계로 남는다.

## 위험도

LOW
