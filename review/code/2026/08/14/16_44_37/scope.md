### 발견사항

- **[INFO]** 순수 포맷팅(빈 줄 1개) 삽입이 기능 변경 커밋에 섞여 들어감
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:133`(빈 줄) — 바로 아래 `134| @Injectable()` / `135| export class InteractionService {`
  - 상세: `stripAndRedact` 헬퍼 도입과 같은 hunk 안에서 클래스 데코레이터 위에 공백 줄 하나가 추가됐다. 동작에 영향 없는 순수 포맷팅이며 커밋 목적(REST 스냅샷 `llmCalls` 누출 차단)과 무관하다. 규모가 1줄이라 실질적 해는 없다.
  - 제안: 조치 불필요(참고용). 향후 유사 diff에서 이런 미세 포맷팅이 누적되면 별도 포맷팅 커밋으로 분리 권장.

- **[INFO]** spec 문서 변경 범위가 "llmCalls 누출 차단" 그 자체보다 넓다 — 단, 정식 절차(BLOCK: YES → planner 턴)를 거쳐 문서화된 정당한 확장
  - 위치: `spec/5-system/14-external-interaction-api.md`(§6.2 `payload` 봉투 래퍼 추가, `interaction` 블록 Planned 명시, `waitingNodeType` 필드 매핑 추가, `error.code`/`nodeId` null 허용), `spec/1-data-model.md`(`Execution.error` 구조 nullable화)
  - 상세: 이 diff 는 `plan/in-progress/eia-terminal-payload.md`가 `🚫 구현 차단 — --impl-prep BLOCK: YES`로 명시적으로 developer 권한을 넘는 spec drift를 기록하고, 커밋 `4b13ca5ae`("코드가 앞질러 있던 서술 7곳을 따라잡힌다")가 `--spec BLOCK: NO` 확보 후 정식 planner 턴으로 반영했음을 커밋 메시지·plan 문서로 직접 확인했다(CLAUDE.md §Skill 체계 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"을 그대로 따름). §6.2 봉투 불일치·`error.code` null 문제는 이번 보안 조사 중 발견된 실제 spec drift이며, 근거·기각된 대안·이력이 spec 본문과 plan 양쪽에 기록돼 있어 "몰래 끼워 넣은 무관한 변경"은 아니다.
  - 제안: 조치 불필요. 스코프 관점에서는 절차를 준수한 확장이므로 위반이 아니다(기록 목적).

- **[INFO]** `review/code/**`, `review/consistency/**` 하위 대량 신규 파일(수십 개, 이번 세션의 리뷰 라운드 산출물)은 애플리케이션 코드 스코프 판단 대상이 아니다
  - 위치: `review/code/2026/08/14/{10_32_27,11_02_16,12_06_20,14_30_35,14_55_29,15_58_26,16_29_50}/**`, `review/consistency/2026/08/14/{07_44_12,09_38_17,10_32_29,11_02_18,12_06_21,14_30_36,14_55_31,15_06_43,15_20_28,15_36_59}/**`
  - 상세: `CLAUDE.md` "정보 저장 위치" 표가 `review/code/<...>`·`review/consistency/<...>`를 코드 리뷰/일관성 검토 산출물의 정식 저장 위치로 명시하고, 이 저장소는 이를 git 추적한다(gitignore 대상 아님). 전량 신규 파일·insert-only이며 기존 파일 수정이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 핵심 애플리케이션 코드 diff는 단일 관심사(`llmCalls` 외부 노출 차단)에 정확히 스코프됨 — 직접 hunk 단위로 확인
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts`(신규 파일, `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields`/`stripDeep`), `codebase/backend/src/modules/websocket/websocket.service.ts`(구 `stripExternalOnlyFields`를 공유 유틸 호출로 교체 + `maxDepth` 인자 추가, 단일 관련 hunk 2곳), `codebase/backend/src/modules/external-interaction/interaction.service.ts`(신규 `stripAndRedact` 헬퍼 + 3개 호출부 교체, import 2줄 추가), `codebase/backend/src/modules/websocket/websocket.service.spec.ts`/`interaction.service.spec.ts`/`strip-external-only-fields.spec.ts`(각각 단일 hunk, 순수 추가, 기존 테스트 수정·삭제 없음)
  - 상세: `git diff origin/main...HEAD`를 파일별로 직접 열어 확인한 결과, import 변경은 실제 사용되는 신규 심볼(`stripExternalOnlyFields`, `MAX_REDACT_DEPTH`)뿐이고 미사용 임포트나 정리성 임포트 변경이 없다. 각 spec 파일의 hunk 수도 1개씩으로, 무관한 기존 테스트를 건드리지 않고 신규 `it()`/`it.each()` 블록만 순수 추가됐다. `websocket.service.ts`에서 구현이 옛 depth-1 shallow strip에서 공유 재귀 유틸 호출로 바뀐 것도 CHANGELOG·plan이 설명하는 동일 보안 결함(depth 우회) 수정의 일부다.
  - 제안: 없음(positive finding).

### 요약

핵심 애플리케이션 코드(`strip-external-only-fields.ts` 신규 + `websocket.service.ts`/`interaction.service.ts` 수정 + 대응 spec 3개)는 `execution.waiting_for_input`의 `turnDebug.llmCalls` raw 프롬프트가 WS fanout과 REST `getStatus` 두 경로로 새던 단일 보안 결함에 정확히 스코프돼 있으며, 무관한 리팩토링·기능 확장·미사용 임포트·설정 변경은 발견되지 않았다(발견된 것은 1줄짜리 무해한 포맷팅 삽입뿐). `spec/5-system/14-external-interaction-api.md` 등의 문서 확장은 표면적으로는 범위가 넓어 보이나, `plan/in-progress/eia-terminal-payload.md`의 `BLOCK: YES` → planner 턴(`4b13ca5ae`)이라는 정식 절차를 통해 이번 보안 조사 중 발견된 실제 spec drift를 정정한 것으로 확인돼 스코프 위반이 아니다. `review/code/**`·`review/consistency/**`의 대량 신규 파일은 프로젝트가 정식으로 지정한 리뷰 산출물 저장 위치이며 코드 스코프 판단 대상이 아니다. 종합적으로 이 diff는 브랜치 목적(보안 결함 수정 + 그 과정에서 드러난 spec drift 정정)에 일관되게 좁게 유지되고 있다.

### 위험도
NONE
