# 신규 식별자 충돌 검토 — spec-draft-deletion-releases-trigger-resources

## 발견사항

- **[CRITICAL]** 트래커 라벨 `T2`(및 `T1`)가 같은 대상 문서 안에서 이미 다른 의미로 확립돼 있다
  - target 신규 식별자: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` `## 트래커 반영 (같은 PR)` 표의 `T1`(`8·9` 항목 표기 전환) · `T2`(developer 항목 신설: D1·D3~D6 구현) · `T3`(planner 항목 종결)
  - 기존 사용처: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 2251~2530 부근. `T1`(`impl-chat-channel-binder-t1` — 검증·변환 순수 함수 추출, "assertChatChannelInputSafe" 등)과 `T2`(`impl-chat-channel-binder-t2` — secret 쓰기·ref 보존, `ChatChannelBinderService`)는 그 문서 안에서 이미 30곳 넘게 반복 인용되는, 특정 리팩터 PR 분할을 가리키는 확립된 라벨이다(예: 라인 2253 "T1 이 만든 같은 결함", 2424 "T1 이 옮긴", 2505~2506 표, 2513 "T2 완료").
  - 상세: target 의 `T1` 항목은 "«`spec-draft-nullable-notation-followups.md` developer 항목(트리거 락 후속) 표의 **8·9**» 를 «→ 이 draft D5 로 흡수 — 구현은 **T2**» 로 전환 표기"하라고 지시한다. 즉 이 draft 가 실행되면 문자열 `T2` 가 **바로 그 대상 파일**(followups 트래커) 안, 이미 `T2`(chat-channel-binder-t2 추출)가 확립돼 있는 같은 문서에, 완전히 다른 의미(이 draft 가 신설하는 "삭제 경로 정리 구현" developer 항목)로 새로 삽입된다. 같은 파일 안에서 `T2` 를 grep 하면 서로 무관한 두 의미(구 리팩터 분할 vs 신규 삭제-정리 구현 항목)가 뒤섞여 나오게 되고, 삽입되는 문장("구현은 T2")은 "이 draft 의 T2" 라고 명시적으로 되풀이하지 않아 문맥만으로 구분해야 한다. `T1` 도 같은 표 안에서 별도 의미(표기 전환 자체)로 정의되어 있어 잠재적으로 같은 위험을 안고 있다(다만 `T1` 문자열 자체는 삽입 문장에 나타나지 않는다 — 삽입되는 것은 `T2` 뿐).
  - 제안: target 의 트래커 반영 표 라벨을 그 대상 문서의 기존 계열과 겹치지 않는 이름으로 바꾼다(예: `TR1`/`TR2`/`TR3`, 또는 draft 고유 프리픽스 `DEL-T1`/`DEL-T2`/`DEL-T3`). 최소한, 삽입될 실제 문장에서는 "구현은 T2" 대신 "구현은 **이 draft(spec-draft-deletion-releases-trigger-resources)의 T2**" 처럼 대상 draft 를 매번 명시해 대상 문서의 기존 `T1`/`T2` 계열과 참조 스코프를 분리한다. (참고: 이 저장소에서 짧은 라벨 재사용 충돌은 선례가 있다 — `D-*`→`CV-*` 전환에서 두 번 발생했고 둘 다 "기존 계열 미열거"가 원인이었다.)

## 확인했으나 충돌 없음 (참고용, 검토 범위 명시)

- **요구사항 ID**: target 이 언급하는 `CCH-AD-03`, `SS-SE-05`, `R4`(secret-store.md 고유) 는 모두 기존 문서에 이미 존재하는 ID 를 **같은 의미로** 재인용한 것이며 새 ID 부여가 아니다. `R4`(secret-store.md) 와 `R-4`(trigger-list.md), `R4`(chat-channel-adapter.md/telegram.md) 는 문서별 로컬 번호 체계이고 draft 스스로도 "비대상" 절에서 "문서마다 다르지만 늘 경로와 함께 인용돼 충돌이 없다"고 명시 — 실측(grep)으로도 항상 파일 경로와 동반 인용됨을 확인, 문제 없음.
- **엔티티/타입명**: 새 DTO·인터페이스·엔티티 도입 없음. 기존 `TriggersService`, `SchedulesService`, `WorkflowsService`, `WorkspacesService`, `SecretResolver`, `secret_store` 등 기존 명칭만 사용.
- **API endpoint**: 새 endpoint 없음. 기존 `DELETE /api/triggers/:id`, `DELETE /api/schedules/:id`, `DELETE /api/workflows/:id`, `DELETE /api/workspaces/:id` 를 그대로 인용.
- **이벤트/메시지명**: webhook·queue·SSE 이벤트 이름 신설 없음.
- **환경변수·설정키**: 신규 ENV var·config key 없음.
- **파일 경로**: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` 는 기존 `spec-draft-*` 명명 컨벤션을 따르고, `ls plan/in-progress/` 기준 이름 충돌 없음. `spec/` 대상 파일 7개는 모두 기존 파일 편집이며 신규 파일 생성이 없다.
- **섹션 anchor**: `spec/2-navigation/2-trigger-list.md` §4.3(`### 4.3 cascade 동작`)·§4.4(`### 4.4 결과·에러`)·§3(`## 3. API`) 는 draft 가 인용하는 앵커(`#43-cascade-동작`, `#44-결과에러`, `#3-api`)와 실제 제목이 일치 — 새로 만드는 섹션이 아니라 기존 섹션에 내용을 추가하는 것으로 확인. `secret-store.md §6` 제목 변경("Trigger 삭제 시 cascade" → "트리거 행이 없어질 때 cascade")으로 앵커가 바뀌지만, 그 구 앵커를 인용하는 자리는 `spec/`·`codebase/`·`plan/` 전체에서 grep 0건 — dangling reference 없음 확인.

## 요약

이 draft 는 spec 계약 정정 위주라 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·파일 경로 축에서는 새 식별자 충돌이 없다. 다만 `## 트래커 반영 (같은 PR)` 표에서 도입한 `T1`/`T2`/`T3` 라벨 중 `T2`(및 잠재적으로 `T1`)가, 바로 그 편집 대상인 `spec-draft-nullable-notation-followups.md` 안에 이미 확립된 동명의 `T1`/`T2`(chat-channel-binder 추출 리팩터의 PR 분할 라벨)와 의미가 완전히 다른 채로 같은 문서에 삽입될 예정이라는 점이 실질적 충돌이다. 이 저장소에는 짧은 라벨 재사용으로 인한 동일 클래스의 충돌 선례가 있어(`D-*`→`CV-*`), 병합 전에 라벨을 바꾸거나 스코프를 명시하는 정정이 필요하다.

## 위험도

MEDIUM
