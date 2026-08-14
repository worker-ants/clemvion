### 발견사항

- **[INFO]** 브랜치/plan 제목("종결(terminal) payload 정리", `plan/in-progress/eia-terminal-payload.md`)과 실제 코드 diff(`interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts`)의 표면 내용이 다르다 — 그러나 문서로 완전히 추적·정당화돼 있어 스코프 위반으로 보지 않는다
  - 위치: `plan/in-progress/eia-terminal-payload.md`(`## 🚫 구현 차단 — --impl-prep 07_44_12 BLOCK: YES` 절, 신규 파일) · `plan/in-progress/spec-draft-eia-62-waiting-payload.md`(신규 파일, `### 처분 (실제 상태)` 절)
  - 상세: `eia-terminal-payload` 작업(=`error` 객체화·`durationMs`·`result.outputs`)은 `--impl-prep`이 spec CRITICAL로 착수 자체를 막았고(`plan/in-progress/eia-terminal-payload.md`의 체크리스트에 `[ ] 구현 + 테스트`가 여전히 미완료로 남아 있음), 조사 도중 발견된 별건 보안 결함(`llmCalls` raw 프롬프트가 fanout·REST 양쪽으로 새는 것)의 수정으로 이번 라운드 전체가 소진됐다. 이 전환은 `plan/in-progress/eia-terminal-payload.md`·`spec-draft-eia-62-waiting-payload.md`·`spec-draft-eia-notification-payload-contract.md` 세 문서에 걸쳐 명시적으로 기록돼 있고, 직전 라운드(`10_32_27`) scope 리뷰가 지적했던 "선호안(b) vs 실제 채택(a) 불일치"도 이번 diff에서 `spec-draft-eia-62-waiting-payload.md:219`(`> 착수 전엔 "(a) 는 비용이 크니 (b) 가 유력" 이라 적었는데 **선택이 뒤집혔다.**`)로 해소돼 있음을 확인했다. 즉 표면적 제목 불일치는 있으나 "계획 없이 슬쩍 들어간 변경"이 아니라 인계 조건까지 문서화된 의도적 우선순위 전환이다.
  - 제안: 조치 불필요. 참고 기록.

- **[INFO]** `spec/1-data-model.md`·`spec/5-system/14-external-interaction-api.md`의 `error.code`/`nodeId` nullable화, §6.2 `payload:` 봉투 래퍼 추가, `interaction` 블록 Planned 표기 등은 이번 보안 수정과 직접 관련은 없으나, `eia-terminal-payload.md`의 `--impl-prep` BLOCK을 해제하기 위해 `project-planner` 권한으로 별도 수행된 선행 정정 작업이다 — drive-by 수정이 아니다
  - 위치: `spec/5-system/14-external-interaction-api.md` §6.2/§6.4 (커밋 `4b13ca5ae`), `spec/1-data-model.md` §2.14
  - 상세: `plan/in-progress/eia-terminal-payload.md`의 "차단 해제 조건" 절이 이 spec 정정을 명시적으로 요구하고 있고, 새로 작성된 `spec-draft-eia-62-waiting-payload.md`의 frontmatter `owner: project-planner`가 이 작업이 `developer`가 아닌 `project-planner` 턴에서 수행됐음을 보여준다(CLAUDE.md의 "spec/ 변경 → project-planner" 규약 준수). CHANGELOG.md에는 이 spec 정정 자체는 언급되지 않고 보안 수정만 기재돼 있는데, spec 변경은 사용자 대상 변경 로그 항목이라기보다 내부 문서 정합화라 이 자체는 문제로 보지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 핵심 코드 diff(`interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts(+specs)`)는 단일 보안 결함(외부 fanout·REST 양쪽에서 `llmCalls` raw 프롬프트가 깊이 무관 위치에서 누출)에 정확히 좁게 스코프돼 있다 — 확인했으나 문제 없음
  - `interaction.service.ts` diff(66줄)는 `deepRedactSecrets` 단독 호출 3곳을 새 헬퍼 `stripAndRedact`(strip + redact 결합)로 교체한 것과 그 헬퍼 정의뿐이다. import 추가(`MAX_REDACT_DEPTH`, `stripExternalOnlyFields`)도 신규 사용처와 1:1로 대응한다.
  - `websocket.service.ts` diff(55줄)는 기존 `stripExternalOnlyFields`(depth-1) 함수 정의를 삭제하고 신규 공유 유틸 호출로 교체한 것과 `EXTERNAL_STRIPPED_FIELDS` 상수 이전뿐이다.
  - `strip-external-only-fields.ts`(신규 125줄)·`interaction.service.spec.ts`(+91줄)·`websocket.service.spec.ts`(+226줄)·`strip-external-only-fields.spec.ts`(신규 177줄)는 전부 이 결함의 회귀 테스트·유틸 자체의 단위 테스트다. 기존 테스트 수정·삭제는 없고 순수 추가뿐이다.
  - 무관한 리팩토링·포맷팅·불필요한 import 정리·설정 파일 변경 없음을 확인했다(`git diff origin/main...HEAD`에서 `*.json`/`*.yml`/`tsconfig`/`eslintrc` 등 설정 파일 변경은 review 산출물 `_retry_state.json`(파이프라인 메타데이터) 외에는 전무).

- **[INFO]** `review/code/**`·`review/consistency/**` 아래 134개 파일(전체 147개 중 대다수)은 이번 라운드까지의 9회 ai-review/consistency-check 파이프라인 산출물이며 신규 코드/설정 변경이 아니다
  - 상세: CLAUDE.md의 정보 저장 위치 규약상 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`", "일관성 검토 산출물 → `review/consistency/...`"로 지정돼 있고, 이 파일들은 모두 신규 생성(diff가 전부 `new file mode`)이라 기존 리뷰 산출물을 수정한 것도 아니다. 스코프 위반이 아니라 프로젝트가 상시 승인한 강제 리뷰 루프의 정상 부산물이다.
  - 제안: 조치 불필요.

### 요약
핵심 코드 변경(`interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts` 및 대응 spec 파일)은 "`llmCalls` raw 프롬프트가 fanout·REST 양쪽에서 깊이 무관 위치로 새는" 단일 보안 결함에 정확히 좁게 스코프돼 있고, 무관한 리팩토링·포맷팅·불필요 import·설정 변경이 없다. 브랜치/plan 제목("종결 payload 정리")과 실제 diff 내용(보안 수정)이 표면적으로 어긋나 보이지만, 이는 impl-prep이 원래 작업을 spec CRITICAL로 차단해 발생한 의도된 우선순위 전환이며 세 plan 문서(`eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)가 그 전환·인계 조건·이전 라운드에서 지적된 처방 선택 번복 사유까지 일관되게 기록하고 있다. spec 문서(`spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`) 변경도 그 차단 해제를 위한 `project-planner` 턴의 정당한 선행 작업으로 확인된다. 파일 수(147개) 대부분(134개)은 review/consistency 파이프라인이 규약대로 생성한 산출물이라 스코프 판단 대상에서 제외했다. 전반적으로 이번 diff는 스코프 관점에서 규율이 잘 지켜져 있다.

### 위험도
LOW
