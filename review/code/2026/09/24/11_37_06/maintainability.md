# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `removeMember()` 의 판정부가 주석 대비 코드 밀도가 낮고, 책임 수가 늘어난 채로 한 함수에 남아 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:814-906` (`removeMember`)
  - 상세: 함수 전체가 93줄인데 실질 코드는 약 39줄, 나머지 52줄이 주석이다(순서·동시성 근거 서술). 이번 diff 로 가드 분기가 하나 더 늘어(요청자 멤버십 확인) 함수가 담당하는 책임이 (1) 요청자 인가(멤버십+admin) (2) self-위임 분기 (3) 대상 owner 가드 (4) 동시성-원자적 DELETE (5) 0-affected 원인 판별 (6) 감사 로그, 총 6갈래로 늘었다. 다만 각 분기가 guard-clause 형태(얕은 중첩, 최대 깊이 2)라 가독성 자체는 유지된다. 이 항목은 직전 라운드(`review/code/2026/09/24/11_10_45/maintainability.md` INFO 3번)가 이미 "주석 12줄 vs 코드 2줄" 로 지적했고 "현 상태 유지 가능"으로 결론 낸 사안과 같은 함수를 겨냥한다 — 이번 diff 가 그 판단을 바꿀 만큼 악화시키지는 않았다(순수 재배치 + 2개 분기 추가).
  - 제안: 지금 당장 조치 불필요. 다만 향후 이 함수에 분기가 하나 더 추가되면(예: 13-라우트 축 후속 PR), 인가 부분(멤버십+admin 판정)을 `assertRemovableTarget` 류의 private 헬퍼로 뽑아 "인가"와 "원자적 삭제+충돌 해소"를 시각적으로 분리하는 것을 고려할 것.

- **[INFO]** `where` 기반 mock 라우팅 로직이 두 `describe` 블록에 중복 등장한 상태가 이번 라운드에도 그대로 남아 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1291-1303` (`records member.removed …`)와 `:1498-1511`(`wireFindOne` 내부, 이번 diff 로 `requesterMembership` 이 `null` 도 받도록 확장됨)
  - 상세: 직전 라운드(`11_10_45/maintainability.md` INFO 1)가 "선택적 개선"으로 이미 지적한 중복이며 이번 diff 로 해소되지 않았다. `wireFindOne` 쪽은 이번 diff 에서 `requesterMembership: Record<string, unknown> | null` 로 시그니처가 넓어져 두 구현의 분기 로직(“`where.id` 가 대상과 같은가”) 차이가 조금 더 벌어졌다 — 대상 조회 쪽은 여전히 고정 payload, `wireFindOne` 쪽은 `null` 분기가 추가됐다.
  - 제안: 조치 불요(직전 라운드 판단 유지). `removeMember` 관련 mock 구성이 한 번 더 늘어나면 공용 헬퍼 추출을 고려.

- **[INFO]** 신규 e2e 테스트의 타임아웃(`120_000`)은 파일 내 다른 타임아웃(`30_000` 1건)과 크게 차이 나지만, 저장소 전체 e2e 컨벤션 범위 안이다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:732`
  - 상세: 같은 파일에는 명시 타임아웃이 `30_000` 한 곳뿐이라 `120_000` 이 눈에 띄지만, 저장소 e2e 전체에서 `120_000` 은 10건이 이미 쓰이는 값(등록 2회+초대수락+동시 프로브 3건을 도는 테스트 성격상 근거 있음)이라 매직 넘버라기보다 기존 컨벤션 재사용이다.
  - 제안: 조치 불요.

- **[INFO]** `throwNotAMember()`/`throwAdminRequired()` 추출은 기존 컨벤션(`throwMemberNotFound()`/`throwCannotRemoveOwner()`)을 그대로 따르고 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:913-926`
  - 상세: 네이밍(`throw` + PascalCase 사유), 배치(첫 사용처 인근), 그리고 `assertMembership`/`assertAdmin` 이 같은 헬퍼를 재사용하도록 리팩터(`:928-941`)한 것까지 기존 패턴과 일관된다. 같은 판정문을 두 곳(직접 호출 경로·assert 경로)에서 공유해 메시지 드리프트를 구조적으로 막는다는 점에서 오히려 중복 제거에 기여한다.
  - 제안: 없음(긍정 사례로 기록).

## 요약

핵심 변경(`removeMember` 인가 순서 재배치, `throwNotAMember`/`throwAdminRequired` 추출, 대응 unit·e2e 테스트 3종 추가, CHANGELOG 정정)은 유지보수성 관점에서 양호하다. 새 가드는 기존 파일의 guard-clause·단일 실패-헬퍼 컨벤션을 그대로 따르고, 타입 내로잉(`if (!requesterRole) throwNotAMember()` 뒤 `ADMIN_ROLES.has(requesterRole)`)도 별도 캐스트 없이 안전하게 동작한다(뮤턴트 M1 이 이를 컴파일 오류로 확인). 새로 추가된 세 unit 테스트는 각각 무엇을 보호하는지, 왜 기존 테스트로는 그 계약을 가르지 못하는지를 docblock 에 명시해 회귀 방지 의도가 코드에 남는다. 발견된 항목은 전부 INFO 수준이며, 그중 둘(주석 밀도·mock 로직 중복)은 직전 라운드(`11_10_45`)가 이미 짚고 "당장 조치 불요"로 결론 낸 것과 동일 자리로, 이번 diff 가 그 결론을 바꿀 만큼 상황을 악화시키지 않았음을 재확인했다. 신규 CRITICAL/WARNING 은 없다.

## 위험도

NONE

## 참고 — 작업트리 상태 이상 관측(리뷰 대상 아님)

리뷰 도중(내가 만든 것이 아님) `codebase/backend/src/modules/workspaces/workspaces.service.ts` 에
미커밋 변경이 나타났다 — `if (!ADMIN_ROLES.has(requesterRole)) this.throwAdminRequired();` 를
self-위임 분기 **앞**으로 옮기고 `// MUTATION M4: admin check moved before self-delegation` 주석을
남긴 상태다. `plan/in-progress/member-auth-order.md` 뮤턴트 표의 M4(self 위임 분기를 admin 판정
뒤로)와 일치하는 모양이라, 동시에 도는 다른 reviewer 세션이 뮤테이션 테스트를 진행 중인 것으로
보인다. 이 리뷰의 위 발견사항·줄 번호는 이 변경이 나타나기 **전** `Read`/`Bash` 로 확인한 원본
기준이다. 프로토콜에 따라 `git checkout`/`restore` 로 되돌리지 않았다 — 진행 중인 다른 세션의
작업일 수 있어서다. 다음 라운드에서 이 파일을 열 reviewer 는 `git status --short` 로 잔여 여부를
먼저 확인할 것.
