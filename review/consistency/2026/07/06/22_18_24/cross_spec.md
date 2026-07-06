### 발견사항

- **[INFO]** `team_invite` Rationale 의 auth spec 절 번호 인용 오류 (§1.5.2 → §1.5.3)
  - target 위치: `spec/data-flow/8-notifications.md` §Rationale "team_invite 채널 — 이메일 중복 회피" 내 "기존 가입자도 이 링크로 로그인·이메일 일치가 감지되어 accept 흐름으로 분기한다" 문장의 인용 `[spec/5-system/1-auth.md §1.5.2]`
  - 충돌 대상: `spec/5-system/1-auth.md` §1.5.2(제목 "흐름 (미가입자 가입 경로)")·§1.5.3(제목 "흐름 (이미 가입한 사용자가 다른 워크스페이스에 초대된 경우)")
  - 상세: 인용문이 설명하는 동작("기존 가입자가 초대 링크로 로그인 감지 후 accept 흐름으로 리다이렉트")은 실제로 §1.5.3 및 그 직후 각주(line 267, "이미 로그인한 사용자가 이 링크로 진입하면 … 위 수락 페이지로 리다이렉트")에 기술되어 있다. §1.5.2 는 반대로 미가입자 전용 가입 트랜잭션을 다룬다. 데이터·계약 충돌은 아니지만 절 번호가 실제 내용과 어긋나 cross-reference 를 따라가는 독자를 오도할 수 있다.
  - 제안: `spec/data-flow/8-notifications.md` 의 해당 인용을 `§1.5.3`(또는 §1.5.3 직후 각주)으로 정정.

### 요약
이번 diff 는 `spec/data-flow/8-notifications.md` 의 `team_invite` 알림 채널을 `both`→`in_app` 으로 정정하고, 짝을 이루는 `spec/2-navigation/9-user-profile.md §5.1` 에도 동일 커밋에서 주석을 추가해 두 문서가 서로를 정합하게 cross-reference 한다. `channel` enum(`in_app/email/both`, `spec/1-data-model.md` §725)·`_layout.md` 의 `team_invite` 딥링크 매핑(`/profile`, id 불요)·다른 알림 type 의 채널 결정 로직 어디와도 모순이 없으며, 새 요구사항 ID·엔티티·상태 전이·RBAC 변경도 없다. 유일하게 발견된 것은 새로 추가된 서술이 인용한 auth spec 절 번호(§1.5.2)가 실제 해당 동작을 기술하는 절(§1.5.3)과 어긋나는 경미한 cross-reference 오류다.

### 위험도
LOW
