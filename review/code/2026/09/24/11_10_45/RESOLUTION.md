# RESOLUTION — `review/code/2026/09/24/11_10_45` (1라운드)

Critical 1 · Warning 5. 전부 이번 턴에 처리했다(둘은 `spec/` 이라 planner 등재).

## 조치 항목

| # | 카테고리 | 조치 | 커밋 |
| --- | --- | --- | --- |
| **C1** | Documentation — CHANGELOG 미갱신 | 신규 항목 추가 + 직전 PR 이 남긴 «남는 것: 권한 검사 순서 오라클은 여전히 열려 있다» 전방 참조를 **취소선 + 해소 주석**으로 정정. 계약 변경(`CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED`)도 명시 고지 | `3fcc19e2c` |
| W1 | Testing — 비-admin self-removal 미검증 | editor 요청자로 «자기 자신이면 위임되고 `ADMIN_REQUIRED` 가 아니다» 를 직접 단언하는 블록 추가. 기존 self 테스트는 요청자가 기본값 `owner` 라 admin 판정을 어차피 통과해 **계약을 가르지 못했다** | `3fcc19e2c` |
| W2 | Documentation — `wireFindOne` docstring stale | «`assertAdmin` 이 부르는 요청자 멤버십» → «`getMemberRole` 로 **직접** 읽는다» 로 정정. 순서-결합을 피한 이유도 함께 적었다 | `3fcc19e2c` |
| W3 | Documentation — 예고 문구가 실제 처방과 다름 | «후속 PR 이 `assertAdmin` 을 앞으로 옮길 예정» 을 과거형 + 실제 메커니즘으로 갱신. `assertAdmin` 자체는 **안 옮겼다** — 통째로 앞에 두면 자가 탈퇴가 깨진다. 그 블록이 admin/owner **순서를 가르지 못한다**는 것도 명시 | `3fcc19e2c` |
| W4 | Documentation — `ADMIN_REQUIRED` 카탈로그 발행처 단수 | **planner 등재**(§보류) | `3fcc19e2c` (트래커) |
| W5 | API Contract — `1-auth.md:551` 이 사라진 호출을 인용 | **planner 등재**(§보류) | `3fcc19e2c` (트래커) |

### C1 은 직전 PR 에서 같은 지적을 받고 또 놓친 것이다

`#1384` 의 3라운드 W1 이 정확히 «CHANGELOG 가 사실관계를 거꾸로 적었다» 였고, 그 커밋 메시지에
*"사실을 뒤집었으면 그 사실을 적은 자리를 전부 훑어야 한다"* 고 적었다. **이번엔 훑지 않았다.**
게다가 그 PR 이 남긴 전방 참조(«오라클은 여전히 열려 있다»)를 이 PR 이 닫았으므로, 방치하면
기록이 거짓이 된다 — 같은 파일의 `:130`·`:173` 이 이미 보이는 취소선 관례를 이 항목만 건너뛰었다.

### W1 의 테스트가 실제로 판별하는지 쟀다

| 뮤턴트 | 예측 | 실측 | 죽은 테스트 |
| --- | --- | --- | --- |
| **M4**: self 위임 분기를 admin 판정 **뒤로** | 1 | **1** | «비-admin 도 자기 자신이면 위임된다 — ADMIN_REQUIRED 가 아니다» |

기존 self 테스트는 이 뮤턴트에 **초록**이다(요청자가 owner). 리뷰어 지적이 정확했다.

## TEST 결과

| 단계 | 결과 |
| --- | --- |
| lint | PASS (`_test_logs/lint-20260924-112419.log`) |
| unit | PASS — backend **472 스위트 / 9946 테스트** (`_test_logs/unit-20260924-112514.log`, 신규 1) |
| build | PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260924-112634.log`) |
| e2e | **통과** — 380 PASS (`_test_logs/e2e-20260924-112929.log`) |

## 보류·후속 항목

**W4·W5 는 유예가 아니라 권한 밖이다.** 셋 다 «`removeMember` 가 `assertAdmin` 을 호출한다» 는
전제로 쓰인 `spec/` 서술이고, `spec/` 은 developer 쓰기 권한 밖이다. 같은 턴에
`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 한 항목으로 **묶어** 등재했다
(`3-error-handling.md:46`·`:49` · `1-auth.md:551` 표로 정리).

> **자기-반증형 소정정 대상이 아니다** — 조건 1(그 문장을 developer 자신이 썼다)이 깨진다.
> `1-auth.md:551` 은 2026-07-28 §3.2 정정 노트이고 내가 쓴 것이 아니다. 조건 2(예고·트리거)도
> 아니다. 리뷰어도 같은 판정을 냈다.

INFO 9건은 전부 «조치 불요» 이거나 이미 트래커 등재(13-라우트 축 · `NOT_A_MEMBER` 열거)다.
