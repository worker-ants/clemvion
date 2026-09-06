# RESOLUTION — `review/code/2026/09/06/10_13_22`

**원 결과**: **Critical 1** · WARNING 3 · 위험도 CRITICAL · forced 7명 전원 산출물 확보
**처분**: Critical 및 WARNING 전부 수정. **실제 유출 하나를 닫았다.**

## Critical 1 — 내가 정의를 한 칸 좁게 잡아 살아있는 유출을 놓쳤다

가드가 관계의 **이름**(`'user'`)으로 매칭하고 **타입**(`User`)으로 하지 않았다. security·
requirement 두 reviewer 가 독립적으로 같은 결론에 도달했고, **실측으로 확인했다**:

```
WorkflowVersion.creator   @ManyToOne(() => User)          ← 타입은 User, 이름은 creator
WorkflowVersionsService.findOne  relations: ['creator']   ← 투영 없음
WorkflowVersionsController.findOne  return service.findOne(...)  ← 가공 없이 반환
```

즉 `GET /api/workflows/:wfId/versions/:versionId` 가 버전 작성자의 `passwordHash`·
`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·
`emailVerifyToken`·`emailChangeToken` 을 전부 내보내고 있었다. 자매 메서드
`findByWorkflow` 는 처음부터 `select` 투영을 갖고 있었다 — **한쪽만 옳았다.**

### 고친 것 (a) — 유출

`findOne` 에 `findByWorkflow` 와 같은 투영을 넣었다 (`creator: { id, name, email }` —
`WorkflowVersionCreatorDto` 가 광고하는 집합과 동일).

그 엔드포인트에는 e2e 가 **한 건도 없어서** 계약 축·이름 축 어느 그물도 닿지 않았다.
세 축을 걸었다 — 이름 부재 · 계약 대조 · `creator` 3필드 양성. 순서는 자매 e2e 와 같은
이유로 이름 축이 먼저다.

unit 도 갱신했다. 기존 테스트가 옛 형태를 고정하고 있어 깨졌는데, 형태 비교만 고치지 않고
**투영 자체를 이름으로 무는 테스트**를 하나 더 뒀다 — 옵션 전체 비교는 형태가 바뀌면 통째로
갈아엎히므로, 그때 무엇이 양보하면 안 되는 성질인지가 남아 있어야 한다.

### 고친 것 (b) — 가드: 목록을 넓히지 않고 출처를 바꿨다

`['user','creator','owner']` 로 **늘리는 것은 같은 결함의 다음 판**이다 — 다음에 누가
`approver: User` 를 만들면 또 놓친다. `collectUserRelationNames` 를 신설해
`*.entity.ts` 의 **타입 주석**에서 파생시킨다 (`User` · `User | null` · `User[]`).

**파생이 내 손 열거보다 넓었다.** 이 결정을 하기 전 `grep '=> User)'` 로 세어
`user`·`creator`·`owner` 셋을 얻었는데, 파생은 **`executor`**(`Execution.executor:
User | null`)를 하나 더 찾았다 — 데코레이터 인자 형태가 달라 grep 이 놓친 것이다. 목록을
넓혔다면 그것도 놓쳤다.

`relations: { creator: true }` **객체 형태**(TypeORM 0.3)도 추가했다. 첫 판은 배열
리터럴만 순회했는데, 하필 유출 지점의 자매 메서드가 이 형태를 쓰고 있었다.

`select` 로 투영한 자리는 세지 않도록 `hasProjectionFor` 를 뒀다 — 없으면
`findByWorkflow` 처럼 **처음부터 옳게 짜인 자리**가 베이스라인을 채워 래칫이 무엇을 막는지
흐려진다.

### 뮤테이션 — 넓힌 가드가 그 Critical 을 무는지 직접 확인

`findOne` 의 투영을 걷어내(= Critical 당시 상태) 래칫을 돌렸다:

```
+ "modules/workflow-versions/workflow-versions.service.ts#findOne"
```

**첫 시도는 겨냥한 자리가 아니었다** — 치환 스크립트가 파일에서 먼저 나오는
`findByWorkflow` 의 투영을 지웠고, 가드는 그쪽을 지목했다. 앵커를 `findOne` 에만 있는
문자열(`snapshot: true`)로 고정해 다시 돌려 위 결과를 얻었다.

## WARNING 2 — e2e 케이스 레터 `F.` 중복 → **수정**

전수로 세어 마지막 레터가 `I.` 임을 확인하고 `J.` 로 바꿨다. (consistency 도 같은 건을
독립 보고했다.)

## WARNING 3 — 신규 가드가 `code:` 밖 → **planner 후속 등재**

`spec/` 쓰기는 권한 밖이다. **정본 게이트에 직접 물어** 확인했다 —
`review_guard._spec_linked_changes()` 가 신규 4파일 중 **0건**을 spec-linked 로 판정한다.
`plan` 에 등재하고, 완료 노트가 그 항목을 가리키게 했다.

## WARNING 4 — `.toLowerCase()` 분기가 관측 불가 → **수정**

리뷰어가 뮤테이션으로 잡았다(그 분기를 지워도 7/7 통과). fixture 에
`relations: ['User']` 케이스를 넣어 관측 가능하게 만들었다.

## INFO#7 — `expectNoUserSecrets` 의 전역 `expect` 의존 → **수정**

자매 헬퍼 `assertMatchesContract` 처럼 **직접 던지도록** 바꿨다. jest 전역 주입에 기대면
`injectGlobals:false` 로 바뀌는 날 호출부 전체가 조용히 깨진다. 메시지에는 샌 경로를 전부
싣는다.

## INFO#8 — `line` 필드 미사용 → **제거**

소비처가 없었다. 대신 **`relation`**(어떤 관계 이름으로 걸렸나)을 넣었다 — 그쪽은 실제로
단언에 쓴다(`creator`·`owner` 를 잡는지 직접 확인). 줄 번호는 애초에 베이스라인에 넣지
않기로 한 값이라, 안 쓰는 채로 두면 다음 사람이 키에 넣고 싶어진다.

## 내가 쓴 거짓 서술 정정

`plan` 과 `CHANGELOG` 가 *"`User` 를 통째로 싣는 자리 3곳 · 셋 다 투영"* 이라고 적고
있었다. **그 열거 자체가 이름 기반이라 좁았다.** 두 문서에서 해당 행을 취소선으로 남기고,
타입 기준 재실측(관계 이름 4종 · 투영 없는 자리 4곳 · 그중 1곳이 실제 유출)으로 갈았다.
CHANGELOG 에는 유출 절을 신설해 영향과 권고를 적었다.

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS |
| unit | PASS |
| build | PASS |
| e2e | PASS — **299** (신규 1건) |

첫 e2e 시도는 postgres 컨테이너가 안 떴다 — Docker 디스크 압박이라 `make e2e-down` +
`builder prune` + `image prune` 으로 **11.45GB** 회수 후 통과했다(코드 문제 아님).
