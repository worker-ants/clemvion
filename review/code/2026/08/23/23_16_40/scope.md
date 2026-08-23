# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 31개 변경 파일 중 21개(파일 9~29)가 이전 리뷰 라운드(`review/code/2026/08/23/22_51_46/**`, `review/consistency/2026/08/23/22_26_33/**`)의 산출물이다.
  - 위치: `review/code/2026/08/23/22_51_46/RESOLUTION.md` 외 다수, `review/consistency/2026/08/23/22_26_33/SUMMARY.md` 외 다수
  - 상세: `RESOLUTION.md`·`SUMMARY.md`·각 리뷰어 `.md`·`meta.json`·`_retry_state.json` 은 CLAUDE.md 가 명시한 `/ai-review` + `/consistency-check` 표준 워크플로가 이 세션에서 실제로 실행되며 생성한 산출물이고, `review/code/**`·`review/consistency/**` 는 그 워크플로의 정식 쓰기 위치다(`developer` 는 `review/**/RESOLUTION.md` 쓰기 권한 보유). 코드 변경과 무관한 임의 문서가 아니라 이번 작업이 거쳐야 했던 필수 절차의 증적이며, 그 자체가 새 산출물(`RESOLUTION.md`)로 "4건 WARNING 전부 처리" 를 명시한다. 범위 이탈로 보지 않는다.
  - 제안: 조치 불요. 참고로 동일 세션의 이전 `scope.md`(22_51_46 라운드, 파일 18 diff 참고)도 같은 결론(NONE)을 냈다.

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` 가 계획 초안(위젯 4키)보다 넓은 8키(위젯 4 + chat-channel 4: `payload`·`title`·`rendered`·`nodeType`)로 확장됐다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` (gate `77`~`88`, `'payload'`·`'title'`·`'rendered'`·`'nodeType'` 추가분)
  - 상세: `plan/in-progress/sse-nodeoutput-allowlist.md`(파일 8) 본문이 스스로 밝히듯, 착수 후 실측(chat-channel 렌더러가 이 4키를 top-level flat legacy shape 으로 읽음)으로 드러난 보정이며, 넣지 않으면 "REST 와 SSE 강도를 맞춘다"는 본래 목표를 지키는 과정에서 Discord/Telegram/Slack 렌더가 조용히 깨진다. 리터럴 테스트·캐너리·뮤테이션(M2)으로 뒷받침돼 있어 요청받지 않은 기능 확장(over-engineering)이 아니라 본래 변경의 정합성을 지키기 위한 필수 보정이다.
  - 제안: 조치 불요.

- **[INFO]** 목록 공유로 인해 REST `getStatus` 응답 표면도 같은 4키만큼 넓어졌다(SSE 를 고치려던 변경이 REST 표면도 함께 넓힌다).
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts`(공유 상수), `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` gate `733`~`763`(신규 캐너리)
  - 상세: 표면별로 목록을 가르지 않기로 한 설계 선택(plan·spec 양쪽에 명시)의 직접적 귀결이며, 이번 diff 가 그 확장이 **의도**임을 REST 쪽 캐너리로 명시적으로 고정했다(RESOLUTION.md W1 항목). "조용히 넓어진 채 방치"가 아니라 의도를 테스트로 못박은 것이므로 무관한 확장은 아니다.
  - 제안: 조치 불요.

- **[INFO]** `node-output-allowlist.ts` 헤더 주석·JSDoc 표가 "소비처 하나(`getStatus`)" 서술에서 "소비처 둘(`getStatus`+`toFanoutEnvelope`)" 서술로 다시 쓰였다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` gate `3`~`16`(주석), `44`~`51`(JSDoc 표)
  - 상세: `websocket.service.ts` 를 두 번째 소비처로 추가한 이번 PR 자신이 그 서술을 즉시 낡게 만들므로, 같은 파일·같은 변경이 유발한 직접 부작용을 그 자리에서 정정한 것이다. 무관한 리팩토링이 아니라 변경과 결합된 필수 수정.
  - 제안: 조치 불요.

- **[INFO]** `spec/5-system/14-external-interaction-api.md`·`spec/5-system/6-websocket-protocol.md`(파일 30, 31) 변경이 포함됐다.
  - 위치: 파일 30 gate `1736`~`1787`, 파일 31 gate `425`
  - 상세: `plan/in-progress/sse-nodeoutput-allowlist.md`(파일 8) 체크리스트의 "(planner 턴) §R17 표의 SSE 행 flip + '강도가 다르다' 서술 제거 + WS §4.4 단서" 항목과 정확히 1:1 대응한다. 추가된 두 disambiguation 각주(`nodeType`/`payload` 동명 필드)도 같은 세션의 consistency-check(`22_26_33`, naming_collision W1·W2)가 지적한 항목의 반영이라 무관한 spec 확장이 아니다. (developer 가 이 spec 파일을 직접 커밋했는지, 별도 planner 턴을 통해 반영했는지는 스코프 관점 밖 — 역할 분리 준수는 별도 프로세스 감사 영역.)
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(파일 7)의 대규모 재작성 — 취소선 보존 + `<details>` 이력 + 4→8키 갱신.
  - 위치: gate `72`~`152`
  - 상세: 이 저장소의 "자기반증형 소정정" 관례(원문 취소선 보존, 반증 근거 명시)를 그대로 따른 정본 트래커 갱신이며, 이번 작업이 그 항목을 직접 종결시킨 당사자이므로 범위 안이다.
  - 제안: 조치 불요.

포맷팅(공백·줄바꿈)만의 변경, 불필요한 import 정리, 관련 없는 리팩토링, 의도 밖 설정 파일 변경, 주석의 무관한 첨삭은 발견되지 않았다. 핵심 프로덕션 변경(`allowlistFanoutNodeOutput` 신설, `toFanoutEnvelope` 배선, allowlist 4키 확장)은 단일 chokepoint 안에서 최소 배선으로 구현돼 있고, 테스트 추가(캐너리·리터럴)는 전부 이번 변경이 만든 새 계약을 검증하는 목적에 국한된다.

## 요약

31개 변경 파일 전부가 "SSE/fanout `nodeOutput` 을 REST 와 동일한 fail-closed allowlist 로 닫는다"는 단일 목표에 직접 연결된다. 핵심 로직 변경(`websocket.service.ts`)·allowlist 확장(`node-output-allowlist.ts`)·대응 테스트(4개 spec 파일)는 plan(`sse-nodeoutput-allowlist.md`)의 작업 목록과 1:1 대응하고, spec 문서 갱신은 그 plan 이 명시한 "(planner 턴)" 체크리스트 항목과 정확히 일치한다. 다수를 차지하는 나머지 파일(review/code, review/consistency 산출물)은 이 프로젝트가 구현 완료 후 상시 강제하는 `/ai-review`+`/consistency-check` 워크플로의 정식 산출물이며, 무관한 파일 수정이 아니다. 이전 라운드(22_51_46)에서 지적된 4건 WARNING 은 이번 diff 에 이미 반영돼 있고 그 반영 내역(RESOLUTION.md)도 범위 안에서 처리됐다. 포맷팅 전용 변경, drive-by 리팩토링, 무관한 주석·임포트 변경은 관찰되지 않았다.

## 위험도

NONE
