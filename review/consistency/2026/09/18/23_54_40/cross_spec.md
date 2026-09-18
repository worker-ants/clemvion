# Cross-Spec 일관성 검토 — 웹훅 `endpoint_path` 전역 유일 draft

## 발견사항

- **[CRITICAL]** `spec/5-system/2-api-convention.md` §12.2 「유니크 제약 범위」 표가 옛 워크스페이스-스코프 전제를 그대로 남긴다 — draft `spec_impact` 목록에 이 파일이 없다
  - target 위치: draft `spec_impact` (5개 파일: `1-data-model.md` · `5-system/12-webhook.md` · `2-navigation/2-trigger-list.md` · `5-system/3-error-handling.md` · `data-flow/10-triggers.md`) — S1~S7 변경안 전체
  - 충돌 대상: `spec/5-system/2-api-convention.md:568-574` §12.2 「유니크 제약 범위」

    ```
    ### 12.2 유니크 제약 범위

    | 필드 | 유니크 범위 | 설명 |
    |------|------------|------|
    | `Trigger.endpoint_path` | 워크스페이스 단위 | 동일 워크스페이스 내에서 중복 불가. 다른 워크스페이스와는 독립 |

    > 인덱스 정의: [데이터 모델 §3](../1-data-model.md#3-인덱스-전략) 참조
    ```

  - 상세: 이 표는 API 규약 문서가 필드별 유니크 제약 **범위**를 모아 둔 단일 카탈로그이고, `Trigger.endpoint_path` 행이 딱 하나 있다.
    "다른 워크스페이스와는 독립" 이라는 문구는 draft 가 「무엇이 문제였나」에서 반증한 바로 그 전제 — 다른 워크스페이스가 같은
    `endpoint_path` 를 등록해도 DB 가 막지 않는다는 것 — 이며, draft 는 이 정확한 전제를 `1-data-model.md`(§2.8·§3·Rationale) ·
    `12-webhook.md`(WH-SC-01·「endpointPath 가변성」) · `2-trigger-list.md`(2곳) · `3-error-handling.md`(2곳) ·
    `data-flow/10-triggers.md`(2곳, S6+S7) 다섯 파일에서 정확히 찾아 고치면서 이 여섯 번째 위치는 열거에서 빠졌다. 더 나쁜 것은
    이 표 바로 아래 인용문 — "인덱스 정의: 데이터 모델 §3 참조" — 이 S2 로 바뀔 `1-data-model.md §3` 을 **직접 가리킨다**. S2 반영
    뒤에는 이 인용이 가리키는 실제 인덱스(`(endpoint_path) UNIQUE WHERE endpoint_path IS NOT NULL`, 전역)와 그 위 표 셀의
    "워크스페이스 단위 / 다른 워크스페이스와는 독립" 서술이 **같은 문단 안에서 서로를 반박**하게 된다. `endpoint_path` 유니크
    범위를 확인하려는 사람이 가장 먼저 찾아볼 법한 일반 API 규약 카탈로그가, 다른 5개 파일이 합의한 새 결정과 정면으로 어긋난
    채 남는다.
  - 제안: draft `spec_impact` 에 `spec/5-system/2-api-convention.md` 를 추가하고, S1~S7 에 S8 을 신설해 §12.2 표 행을
    `| `Trigger.endpoint_path` | 전역 | 라우팅 키(`/api/hooks/:endpointPath`)가 워크스페이스 무관 전역이라 유니크 범위도 전역이다(V132) — 다른 워크스페이스의 트리거와도 겹칠 수 없다 |`
    형태로 교체한다 (`1-data-model.md §3` 인용은 그대로 두되, S2 반영 후 그 인용이 실제로 가리키는 정의와 일치하도록).

- **[WARNING]** `spec/7-channel-web-chat/5-admin-console.md:112` 가 이 draft 가 고치는 것과 같은 용어("중복 가로채기 방지")로
  DB unique 를 이미 충분한 방어로 서술하는데, draft 가 이 위치를 언급하지 않는다
  - target 위치: draft `spec_impact` (위 5개 파일) — 이 파일 미포함
  - 충돌 대상: `spec/7-channel-web-chat/5-admin-console.md:112`

    > **`endpointPath` 검증**: 콘솔은 신규 검증을 도입하지 않고 기존 webhook 트리거 생성 규약(2-trigger-list §2.5)의 형식·유일성
    > 제약을 그대로 따른다 — 공개 webhook path 이므로 경로 주입·**중복 가로채기 방지**는 그 규약(+ **DB unique**)이 단일 책임.
    > 콘솔은 클라이언트 UUID 를 제출할 뿐이다.

  - 상세: 저장소 전체에서 "가로채기" 라는 단어가 웹훅 `endpoint_path` 문맥에 쓰인 곳은 이 한 줄뿐이고(`grep -rn "가로채"`), 그
    한 줄이 정확히 이 draft 의 취약점 클래스("다른 워크스페이스가 등록하면 가로챌 수 있었다")를 "이미 그 규약(+ DB unique)이
    막는다" 고 단언한다. V132 이전에는 이 단언이 **거짓**이었다 — 워크스페이스 단위 UNIQUE 는 다른 워크스페이스의 복사를 막지
    못했고, 웹챗 콘솔의 인스턴스 생성도 결국 `POST /api/triggers`(`TriggersService`)를 거치므로 이 draft 가 고치는 것과 정확히
    같은 경로로 노출돼 있었다. V132 가 적용되면 이 문장은 사후적으로 참이 되지만, draft 가 이 파일을 언급하지 않으면 "이 보장은
    원래부터 옳았다" 는 인상이 남아 이 취약점이 웹챗 인스턴스에도 적용됐던 이력이 가려진다. Critical 은 아니다 — 수정은 DB·
    서비스 계층 한 곳에서 이뤄지므로 웹챗 전용 코드 변경은 불요하고, 이 파일 자체가 틀린 지시를 내리는 것도 아니다(사후에는
    참이 되므로).
  - 제안: `spec_impact` 에 이 파일을 추가할 필요까지는 없으나, S4(`12-webhook.md`) 또는 새 데이터 모델 Rationale 절에서
    "웹챗 콘솔의 트리거 생성(`5-admin-console.md §3`)도 같은 `TriggersService` 경로를 타므로 이 수정으로 함께 보호된다" 한
    문장을 추가해 두 문서가 서로를 인지하게 하거나, 최소한 트래커/Rationale 에 이 위치를 "검토했고 사후 정합함" 으로 기록한다.

## 그 외 확인한 것 (충돌 없음 — 기록)

- S1~S7 이 가리키는 다섯 파일의 정확한 줄(`1-data-model.md` §2.8 line 245 · §3 line 927 · `12-webhook.md` WH-SC-01/「endpointPath
  가변성」· `2-trigger-list.md` line 126, 197 · `3-error-handling.md` line 234, 238 · `data-flow/10-triggers.md` line 173, 245-255)을
  모두 직접 열어 draft 인용 원문과 대조했고, 일치한다. 1차 검토(`23_39_46`, BLOCK:YES Critical 2·WARNING 1)가 지적한 세 항목 —
  (a) V131 의 chat-channel 재등록 우회, (b) `data-flow/10-triggers.md` Rationale 반증 전제 잔존, (c) `error-handling.md` 카탈로그
  행 누락 — 은 각각 결정 2 확장 + 새 Rationale 절("채팅 채널 트리거 — R-CC-21 과의 관계") · S7 신설 · S5 확장으로 해소됐음을
  확인했다. `chat-channel.md` R-CC-21 「기각한 대안」 이 실제로 "`chatChannel` 이 실린 PATCH 에서 `setupChannel` 을 아예 안
  부른다" 를 "endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다" 는 이유로 기각한 이력도 원문에서 확인했다 — draft의
  인용이 정확하다.
- 워크플로 복제·가져오기·버전 복원이 `trigger` 행을 승계하지 않는다는 draft의 전제(`data-flow/11-workflow.md` "복제 범위 밖:
  `trigger`" · "export/import 와 동일한 경계" · "복제가 버전 이력·트리거·데이터셋을 승계하지 않는 이유")를 원문에서 확인했다 —
  "정상 경로로는 워크스페이스 간 중복이 생기지 않는다" 는 draft 의 주장과 정합한다.
- V131(트랜잭션)·V132(`.conf executeInTransaction=false`, DROP(새)→CREATE(새)→DROP(옛) 세 문장) 형태는
  `codebase/backend/migrations/README.md` §5 「인덱스 교체는 DROP-먼저」· 「같은 파일에 transactional statement 와
  CONCURRENTLY 를 섞지 않는다」 규약과 정확히 일치한다(선례 V110).
- 코드 쪽 `idx_trigger_workspace_endpoint`(`V002__indexes.sql`) · `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수 ·
  `triggers.controller.ts` 두 곳의 "동일 워크스페이스에" Swagger 설명을 확인했고, draft 「구현」절이 이들을 모두 개정 대상으로
  적시했다 — 누락 없음.

## 요약

핵심 결정(유일성 범위를 워크스페이스 → 전역으로)과 그에 따른 S1~S7 은 대상 다섯 파일 안에서는 서로 정합하고, 1차 검토가
지적한 Critical 2건·WARNING 1건도 이번 판에서 정확히 해소됐다. 그러나 같은 사실(`endpoint_path` 유니크 범위)을 서술하는
여섯 번째 위치 — `spec/5-system/2-api-convention.md` §12.2 「유니크 제약 범위」 카탈로그 — 가 `spec_impact` 열거에서 완전히
빠져 있고, 이 표는 draft 가 다른 다섯 곳에서 지운 것과 똑같은 "워크스페이스 단위 / 다른 워크스페이스와는 독립" 문구를 그대로
남긴 채 자신이 인용하는 `1-data-model.md §3`(S2 로 전역 UNIQUE 로 바뀔 절)과 직접 모순되게 된다. 부차적으로
`7-channel-web-chat/5-admin-console.md` 의 "DB unique 가 중복 가로채기를 막는다" 는 기존 서술이 이 draft 이전에는 거짓이었다는
점도 draft 본문 어디에도 인지되어 있지 않다. 두 지점 모두 draft 의 핵심 설계를 뒤집지는 않지만, 첫 번째는 반영 즉시 자기모순
문서를 만들기 때문에 병합 전 처분이 필요하다.

## 위험도

MEDIUM
