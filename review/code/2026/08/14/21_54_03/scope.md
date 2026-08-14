### 발견사항

- **[INFO]** 이번 라운드(`21_54_03`)의 실질 신규 델타는 직전 라운드(`16_44_37`) 이후 커밋 2개(`85511cafc`, `462455a52`)뿐이며, 둘 다 직전 라운드의 WARNING/CRITICAL 에 대한 정확한 대응이다 — 신규 스코프 이탈 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts`(주석 전용, `stripAndRedact` 함수 상단 JSDoc 블록에 5줄 실측치 추가), `spec/5-system/14-external-interaction-api.md`(§6.2 blockquote, `waitingNodeType` 행 삭제 + 대체 서술 추가, "Planned" 표기 통일 2곳), `plan/in-progress/spec-draft-eia-62-waiting-payload.md`(REST 경로 실측 표 22줄 추가), `review/code/2026/08/14/16_44_37/RESOLUTION.md`(신규)
  - 상세: `git show 462455a52 --stat` 로 직접 확인한 결과 변경 파일은 위 4개뿐이다(총 +121/-5줄). 커밋 메시지가 명시하듯 이는 ai-review `16_44_37` WARNING("REST 경로 이중 순회 미실측")과 consistency `--impl-done` `16_44_43` CRITICAL("`waitingNodeType` SoT 상충")을 각각 실측·철회로 닫은 것이다. `interaction.service.ts` 변경은 로직 변경이 아니라 이미 실행 중인 `stripAndRedact`/`deepRedactSecrets` 순서 근거에 실측 수치를 보강한 주석뿐이고, `spec/5-system/14-external-interaction-api.md` 변경은 앞선 planner 턴(`4b13ca5ae`)이 잘못 넣은 `node.type -> waitingNodeType` 매핑 행(다른 문서인 WS §4.4 의 소유 영역을 침범)을 철회하고 대체 서술로 교정한 것이다 — 즉 스코프를 **넓히는** 커밋이 아니라 직전의 스코프 침범을 되돌리는 교정 커밋이다. `85511cafc`(HANDOFF 인계 문서)는 순수 plan/review 산출물 추가로 애플리케이션 코드에 영향이 없다.
  - 제안: 조치 불필요.

- **[INFO]** `462455a52` 하나의 커밋 안에 spec/plan 문서 수정과 `codebase/` 주석 수정이 함께 담겨, CLAUDE.md 의 role별 쓰기 권한 구분(project-planner: `spec/**`,`plan/**` / developer: `codebase/**`,`plan/**`)이 커밋 단위에서는 흐려져 있다 — 다만 내용상 실질적 문제는 없다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (JSDoc, `stripAndRedact` 상단) ↔ `spec/5-system/14-external-interaction-api.md`
  - 상세: 두 변경 모두 같은 실측 결과(REST 경로 strip+redact 순서 성능표)를 서로 다른 문서에 병기한 것으로, 커밋 메시지도 "JSDoc·plan 에 병기" 라고 스스로 밝히고 있다. `85511cafc` 커밋 메시지가 "spec 쓰기는 developer 권한 밖이라 planner 턴이 정상 경로" 라고 명시하는 점으로 미루어, spec 수정은 planner 턴에서 이뤄졌고 그 직후(같은 세션) 동일 실측치를 코드 주석에도 반영하면서 한 커밋으로 묶인 것으로 보인다. 로직 변경이 없는 주석 추가라 위험은 낮고, 실측치 하나를 두 위치(주석/spec)에 일관되게 남긴 것 자체는 바람직하다.
  - 제안: 조치 불필요(참고 기록). 향후에도 이런 role 교차 반영이 반복된다면 "spec 정정" 과 "코드 주석 보강"을 별도 커밋으로 나누는 편이 role 경계를 diff 상에서 더 명확히 하겠으나, 이번 건은 규모·위험이 미미해 강제할 사안은 아니다.

- **[INFO]** 브랜치 전체 diff(209 files, origin/main 대비) 중 애플리케이션 소스는 여전히 6개 파일(`interaction.service.(spec.)ts`, `websocket.service.(spec.)ts`, `strip-external-only-fields.(spec.)ts`)뿐이며, 이 6개 파일에 대한 스코프 적합성은 앞선 8개 라운드(`10_32_27`~`16_44_37`)에서 이미 hunk 단위로 확인되어 이번 라운드에서 상태 변화가 없다 — 재확인만 하고 재지적하지 않는다
  - 위치: `git diff origin/main...HEAD --stat` 기준 소스 코드 6개 vs `review/**`(process 산출물, 정식 저장 위치) + `plan/**`/`spec/**`(정식 절차를 거친 문서 정정) 나머지
  - 상세: 직전 라운드(`16_44_37/scope.md`)가 "핵심 애플리케이션 코드는 단일 관심사(`llmCalls` 외부 노출 차단)에 정확히 스코프됨" 을 positive finding 으로 이미 기록했고, 이번 라운드에서 그 6개 소스 파일 자체에는 추가 diff 가 없다(`462455a52` 은 소스 로직 변경 없이 주석만 추가).
  - 제안: 조치 불필요.

### 요약

이번 라운드(`21_54_03`)에서 실제로 새로 검토할 델타는 직전 라운드(`16_44_37`) 종료 이후 커밋 `85511cafc`(순수 plan 인계 문서)와 `462455a52`(spec 정정 + JSDoc 실측치 보강 + RESOLUTION 기록) 뿐이다. `462455a52`은 그 자체가 직전 라운드가 지적한 두 항목(REST 경로 성능 미실측 WARNING, `waitingNodeType` SoT 상충 CRITICAL)에 대한 정확한 교정이며, 스코프를 확장하는 커밋이 아니라 앞선 planner 턴의 문서 오너십 침범을 되돌리는 교정 커밋이다. 로직 변경은 없고(주석 추가뿐), 무관한 리팩토링·기능 확장·불필요한 임포트·설정 변경도 없다. 유일한 경미한 관찰은 spec 수정과 코드 주석 수정이 한 커밋에 함께 담겨 role별 쓰기 권한 구분이 커밋 단위에서 흐려진 점이나, 내용이 동일 실측치의 병기이고 로직 위험이 없어 실질적 문제는 아니다. 애플리케이션 소스 6개 파일 자체의 스코프 적합성은 앞선 8개 라운드에서 이미 확정됐고 이번 델타에서 변화가 없다.

### 위험도
NONE
