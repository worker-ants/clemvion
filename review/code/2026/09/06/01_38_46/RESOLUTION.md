# RESOLUTION — `review/code/2026/09/06/01_38_46` (+ consistency `01_38_47`)

**원 결과**: 코드 리뷰 Critical 0 · WARNING **1** · 위험도 **LOW** ·
consistency **BLOCK: NO** · Critical 0 · WARNING 1
**처분**: 코드 리뷰 WARNING 은 리뷰어 스스로 *"조치 불요(이미 의도적으로 수용·문서화됨)"* 로
적은 이월 항목. consistency WARNING 은 `plan/` 편집으로 해소. **코드 변경 없음.**

## 이 라운드를 수렴으로 판정한 근거

발견의 **성격**으로 판정한다 (개수가 아니라):

| 라운드 | Critical | WARNING | 성격 |
|---|---|---|---|
| `00_00_23` | 0 | 3 | 동작 (자매 누락 · 중복 루프 · 반증된 서술) |
| `00_24_34` | 0 | 4 | 동작 (거짓 인과 · 커버리지 갭) + 문서 |
| `00_48_51` | 0 | 4 | **동작** (내가 만든 CWE-209) + 구조 |
| `01_13_50` | 0 | 7 | 동작 1(`relations` 유실) + 구조 2 + 문서 2 |
| `01_38_46` | 0 | **1** | **신규 발견 0** — 이월 1건, 리뷰어가 조치 불요로 처분 |

- `forced_missing = []` · `unfinished = []` · reviewer **9/9** 산출물 확보 — 못 본 Critical
  때문에 낮게 나온 위험도가 아니다(요약도 그 점을 명시한다).
- INFO 23건 전부 *조치 불요* 이거나 이미 트래커에 등재된 항목이다.

## WARNING 1 (side_effect) — `findAll` blast-radius, 이월·수용

직전 라운드에서 문서화로 대응했고 리뷰어도 그것을 확인했다. 가용성 위험 자체가 사라지지
않으므로 이월 표기된 것이지, 새 지적이 아니다.

**다시 판단해도 결론은 같다.** 대안 둘이 더 나쁘다 — 키 생략은 `ScheduleDto.trigger` 의
§5.4 **기본형** 선언 위반이고, 행 스킵은 목록에서 행이 조용히 사라진다.
`Schedule.trigger_id` 는 NOT NULL 1:1 + FK `onDelete: 'CASCADE'` 라 정상 데이터로는 도달할
수 없고, 도달했다면 **가려서는 안 되는 데이터 손상**이다.

리뷰어가 남긴 **재검토 신호**(*"고아 행이 생길 수 없다는 전제가 깨지는 사고 — 마이그레이션
실수·FK 우회 — 가 발생하면 부분 성공 전략으로 재검토"*)는 CHANGELOG 의 blockquote 가 이미
같은 전제를 명시적으로 적고 있으므로 그대로 둔다. 전제가 깨지면 그 문장이 반증된다.

## consistency WARNING — 후속 항목의 대상이 한 칸 좁았다

`plan/` 편집으로 해소. 상세는 `review/consistency/2026/09/06/01_38_47/RESOLUTION.md`.

## 함께 정리 — 완료 항목이 최종 상태를 절반만 적고 있었다

`plan` 의 「트리거 회전 secret 이 응답에 나간다」 항목(이미 `[x]`)이 *"엔티티 컬럼 2개 +
`config.notification.signing` 키 2개"* 라고 적고 있었다. **등재 시점의 상태**이고, 최종은
**네 축**이다. CHANGELOG 를 넓힌 것과 같은 이유로 여기도 넓혔다:

| 축 | 정화 함수 |
|---|---|
| 엔티티 컬럼 2개 | `deleteSecretColumns` |
| `config.chatChannel` 5키 | `stripChatChannelSecrets` |
| `config.notification.signing` 2키 | `stripNotificationSigningSecrets` |
| `config.interaction.triggerToken` | `stripInteractionSecrets` |

커밋 SHA 열거도 걷어냈다 — 라운드마다 늘어서 적는 순간 낡는다.

## 검증

코드 변경이 없으므로 직전 커밋의 결과가 그대로 유효하다 — lint PASS · unit PASS ·
build PASS · e2e PASS **297**.
