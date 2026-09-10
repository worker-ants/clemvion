# 신규 식별자 충돌 검토 — `spec-draft-trigger-canary-nav.md`

## 검토 대상

- target: `plan/in-progress/spec-draft-trigger-canary-nav.md`
- 신규 식별자: `spec/2-navigation/2-trigger-list.md` 의 Rationale 항목 `R-17` (신설)
- 부수: Change B/C 가 `code:` frontmatter 에 추가하는 glob 패턴 2건, Change D 가 언급하는 신규 파일 경로

실측은 `spec/`, `codebase/` 실제 파일을 대상으로 했다 (target 문서가 담고 있는 corpus 번들과 별개로 저장소 원본을 직접 grep/find).

## 발견사항

- **[INFO]** `R-17` 자체는 `2-trigger-list.md` 문서 내에서 미사용 — 신설 타당
  - target 신규 식별자: `R-17` (`2-trigger-list.md` Rationale)
  - 기존 사용처: 없음. `grep -rn "R-17\b" spec/ plan/` 결과 target 문서(plan) 자신의 언급 1건뿐, `spec/2-navigation/2-trigger-list.md` 실제 파일에는 R-1~R-16 만 존재(`R-2` 는 헤딩에 `(폐기 — R-14 로 대체)` 라 명시돼 있고 본문도 취소선 처리됨 — 사용자 진술과 일치)
  - 상세: 번호 시퀀스가 1→16 까지 빈틈없이 이어지고(폐기된 R-2 도 자리·번호는 유지) 17 이 다음 정수라 로컬 넘버링 규약과 정합. 문제 없음
  - 제안: 없음 (조치 불요)

- **[WARNING]** 저장소 전역에 이미 `R17`(하이픈 없음, `spec/5-system/14-external-interaction-api.md`)이 20개 문서에서 교차 인용되는 하중 큰 식별자다 — 신설 `R-17`(하이픈 있음, 로컬)과 표기가 근접해 혼동 가능
  - target 신규 식별자: `2-trigger-list.md` `R-17`
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:1421` `### R17. getStatus 의 currentNode/context 실값 노출 (…)` — 이 문서는 Rationale ID 를 하이픈 없는 `R1`~`R19` (+ 예외 `R-outbound-flood`, `R-replay-unavailable`) 로 매긴다. `R17` 은 `EIA §R17` 형태로 `spec/1-data-model.md`, `spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/3-execution.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/1-logic/12-background.md`, `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`, `spec/5-system/15-chat-channel.md`, `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/3-auth-session.md`, `spec/conventions/swagger.md`, `spec/conventions/node-output.md`, `spec/conventions/conversation-thread.md`, `spec/conventions/error-codes.md`, `spec/conventions/egress-masking.md` 등 20개 파일에서 인용된다(응답/emit 마스킹 범위의 SoT)
  - 상세: `R17`(EIA, prefix 없음)과 `R-17`(신설, trigger-list 로컬)은 문자열로는 다르지만 하이픈 유무만 차이라 사람이 옮겨 적거나 빠르게 grep 할 때 뒤섞이기 쉽다. 실제로 이번 검토 초입에 `grep "R-17\b"` 로는 0건이었다가 `grep "R17\b"` 로 바꾸자 20개 파일이 쏟아진 것처럼, **하이픈 하나가 검색 결과를 완전히 가른다.** 더구나 `2-trigger-list.md` 본문은 같은 문서 안에서 이미 EIA(`§7.1`, `§7.3`)와 Chat Channel(`R-CC-10`, `R-CC-14` 류)을 빈번히 교차 인용하므로, 새 로컬 `R-17` 이 그 옆에 놓이면 "EIA 의 그 유명한 R17" 과 착각할 여지가 실제로 있다. 다만 앵커·링크 관점에서는 **깨지는 것은 없다** — (a) 두 식별자는 별개 파일에 있고 markdown 앵커는 헤딩 전체 문구로 생성되므로 URL fragment 자체는 절대 겹치지 않는다, (b) 이 저장소의 기존 교차 인용 관례가 이미 "파일명 + Rationale 번호" 를 함께 적는 형태를 쓴다(예: `15-chat-channel.md:610` 의 `[\`spec/2-navigation/2-trigger-list.md\` Rationale R-2](...)`) — 즉 실제 인용문에는 항상 파일 경로가 동반돼 해석 모호성이 낮다. 따라서 CRITICAL(동일 식별자 충돌)은 아니고, "비슷한 이름 혼동 가능" 의 WARNING 등급이 맞다
  - 제안: (1) `2-trigger-list.md` 에 `R-17` 을 신설할 때 그 항목을 다른 문서에서 향후 인용할 경우 반드시 `[spec/2-navigation/2-trigger-list.md Rationale R-17]` 처럼 파일 경로를 동반 표기하도록(기존 R-2 인용 선례와 동일 패턴) 관례를 지키면 충분하며 별도 접두어 신설은 불필요 — `2-trigger-list.md` 자체의 로컬 Rationale 은 아직 EIA/Chat-Channel 만큼 외부 교차 인용 하중이 크지 않다(외부에서 `2-trigger-list.md` Rationale 을 인용하는 곳은 `15-chat-channel.md` 의 R-2 인용 1건뿐 — `grep -rn "2-trigger-list.md#r-" spec/` 실측). (2) 이 세션 이후 `R-17` 을 언급하는 커밋 메시지·plan 문서·PR 설명에서 하이픈을 빠뜨리지 않도록 주의 — 특히 `#1308`/`#1291` 류 커밋 히스토리에서 EIA §R17 논의가 진행 중이므로 같은 시점에 "R-17" 얘기가 오가면 사람이 혼선을 겪기 쉽다

- **[INFO]** `code:` glob `trigger-workflow-ref*.ts` / `schedule-trigger-ref*.ts` 는 실제 파일 목록 기준으로 의도한 범위와 정확히 일치하며, "self-spec 이 헬퍼와 같은 glob 에 걸린다" 는 target 의 자체 경고도 사실과 부합 — 새로 발견된 과매칭 없음
  - target 신규 식별자: `code:` glob 2건 — `codebase/backend/src/shared/testing/trigger-workflow-ref*.ts`(Change B), `codebase/backend/src/shared/testing/schedule-trigger-ref*.ts`(Change C)
  - 기존 사용처: 실제 파일 시스템 (`find codebase -iname "trigger-workflow-ref*"`, `find codebase -iname "schedule-trigger-ref*"`)
  - 상세: 저장소 전체에서 `trigger-workflow-ref*` 로 매칭되는 파일은 3개뿐이다 — `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(Change B 가 별도 항목으로 이미 명시 등재), `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`(의도한 헬퍼 정본), `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`(헬퍼의 유닛 테스트). glob 패턴이 `codebase/backend/src/shared/testing/` 로 디렉터리까지 고정돼 있어 e2e-spec 파일과는 겹치지 않고, `.spec.ts` 유닛 테스트만 추가로 걸린다 — 이는 target 문서 코멘트가 이미 "self-spec 이 헬퍼와 같은 glob 에 걸린다" 라고 예견·수용한 그대로다. `schedule-trigger-ref*.ts` 도 동일 구조(`.ts` 헬퍼 + `.spec.ts` 유닛 테스트 2개만 매칭, 디렉터리 밖 파일 없음). 더 중요한 것은 **같은 문서 안에 이미 선례가 있다** — 기존 `code:` 항목 `endpoint-path-conflict-wrap*.ts` 도 실측 결과 `endpoint-path-conflict-wrap-guard.ts`(정본) + `endpoint-path-conflict-wrap.spec.ts`(유닛 테스트)를 함께 매칭하는 동일 패턴이다. 즉 이번 신설 glob 은 이 문서의 기존 관행과 일관되고, 의도보다 넓게 매칭되는 새로운 문제는 없다
  - 제안: 조치 불요. 다만 `.spec.ts` 를 매칭 대상에 포함하는 것이 매번 "의도적" 임을 target 이 각주로 명시했으므로, 같은 근거를 Change C(`schedule-trigger-ref*.ts`)에도 짧게 한 줄 반복해 두면(현재는 B 에만 각주가 있고 C 는 "축과 무관한 일반 규칙" 이라고만 언급) 다음 사람이 C 를 볼 때 왜 `.spec.ts` 까지 걸리는지 다시 추적할 필요가 없다 — 이는 collision 문제라기보다 문서 대칭성 제안

- **[INFO]** 신규 파일 경로는 다른 spec 의 `code:` 프론트매터와 중복 등재되지 않는다
  - target 신규 식별자: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`, `codebase/backend/src/shared/testing/trigger-workflow-ref*.ts`, `codebase/backend/src/shared/testing/schedule-trigger-ref*.ts`
  - 기존 사용처: 없음 — `grep -rn "trigger-workflow-ref" spec/` 는 0건(YAML `code:` 뿐 아니라 본문 어디에도 없음), `grep -rn "schedule-trigger-ref" spec/` 는 `spec/5-system/14-external-interaction-api.md:936` 과 `spec/conventions/secret-store.md:71` 2건이지만 둘 다 **본문 blockquote 산문**이며 YAML `code:` 리스트 항목이 아니다(두 파일의 실제 `code:` frontmatter 는 각각 `external-interaction/**` 등, `secret-store/**` 뿐 — 직접 확인)
  - 상세: `3-schedule.md` 는 이미 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 를 `code:` 에 등재하고 있으나 이는 `test/` 아래 e2e 파일이고, 신설 glob `schedule-trigger-ref*.ts` 는 `src/shared/testing/` 아래 헬퍼를 가리켜 경로가 달라 중복이 아니다(파일명도 `schedule-trigger.e2e-spec.ts` vs `schedule-trigger-ref.ts` 로 다름 — `-ref` 유무)
  - 제안: 조치 불요

## 요약

target 이 도입하는 유일한 신규 식별자 `R-17`(`2-trigger-list.md` Rationale)은 그 문서 로컬 시퀀스(R-1~R-16, R-2 폐기 표기)와 정합하며 직접적인 재사용(동일 식별자 충돌)은 없다 — CRITICAL 은 없다. 다만 저장소 전역에 이미 20개 문서가 인용하는 하중 큰 `R17`(하이픈 없음, EIA `14-external-interaction-api.md`)이 존재해, 하이픈 하나 차이인 신설 `R-17` 과 표기·구두 인용 시 혼동될 여지가 있다 — 앵커/링크가 실제로 깨지는 것은 아니고 기존 교차 인용 관례(파일 경로 동반 표기)로 충분히 방어되므로 WARNING 으로 판정한다. `code:` 에 추가되는 두 glob 패턴은 실제 파일 목록 대조 결과 의도한 범위(헬퍼 + 그 유닛 테스트)만 정확히 매칭하며, 같은 문서의 기존 `endpoint-path-conflict-wrap*.ts` 선례와 동일한 패턴이라 새로운 과매칭 문제는 없다. 신규 파일 경로 3건 모두 다른 spec 의 `code:` 프론트매터와 중복 등재되지 않는다.

## 위험도

LOW
STATUS: success
