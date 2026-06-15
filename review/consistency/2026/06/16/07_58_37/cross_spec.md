# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상 scope: `spec/2-navigation/6-config.md`
diff-base: `47119617`

---

## 발견사항

### [INFO] `spec/2-navigation/6-config.md §3 API` 표에 Auth Config mutation 엔드포인트의 권한 주석 누락

- **target 위치**: `spec/2-navigation/6-config.md §3 Authentication API` 표, POST/PATCH/DELETE/regenerate 행
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 ("Auth Config | CRUD | CRUD | R | R"), 백엔드 `auth-configs.controller.ts` (`@Roles('admin')` on POST·PATCH·DELETE·regenerate·reveal)
- **상세**: `spec/2-navigation/6-config.md §3` API 표에서 `POST /api/auth-configs/:id/reveal` 행에만 "Admin+" 주석이 있다. `POST /api/auth-configs`(생성), `PATCH /api/auth-configs/:id`(수정·isActive 토글), `POST /api/auth-configs/:id/regenerate`(재발급), `DELETE /api/auth-configs/:id`(삭제) 행에는 권한 주석이 없다. 구현 diff 의 코드 주석(`spec/5-system/1-auth.md §3.2: Auth Config CRUD = Admin+`)은 이 사실을 올바르게 반영하고 있으나, spec 표 자체에 명기되지 않아 열람자가 reveal 만 Admin+ 제한인 것으로 오독할 수 있다. `spec/5-system/1-auth.md §3.2` 의 매트릭스와 실제 백엔드 가드는 일관성이 있으므로 **모순이 아니라 spec 표의 명기 누락**이다.
- **제안**: `spec/2-navigation/6-config.md §3 Authentication API` 표에서 POST·PATCH·DELETE·regenerate 행 설명에 "Admin+" 주석 추가. 예: `| POST | /api/auth-configs | 인증 설정 생성 (Admin+) |`. 또는 표 상단에 일괄 주석: "※ 조회(GET)는 Viewer 이상, 변경(POST·PATCH·DELETE·regenerate·reveal)은 Admin+."

### [INFO] `spec/2-navigation/6-config.md` 에 UI 레벨 RBAC 가드 명기 없음 (isActive 토글 포함)

- **target 위치**: `spec/2-navigation/6-config.md §A.1 화면 구조`, 행 액션 설명 없음
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 ("Auth Config CRUD = Admin+"), 구현 diff (`{isAdmin && <div ... toggle/reveal/edit/regenerate/delete buttons>}`)
- **상세**: 구현 diff 는 `isActive` 활성 토글 버튼을 포함한 모든 변경 액션 버튼을 `{isAdmin && ...}` 블록으로 일괄 가드했다. `spec/2-navigation/6-config.md §A.1` 화면 구조 와이어프레임에는 행 우측 액션에 대한 별도 권한 분기 설명이 없다. "Reveal" 에 대해서만 §A.4 에 "Admin+ 만 노출" 이 명기되어 있고, Add/Toggle/Edit/Regenerate/Delete 의 UI 가드 조건은 기술되어 있지 않다. 구현이 `spec/5-system/1-auth.md §3.2` RBAC 매트릭스를 올바르게 따르고 있으므로 **기능 모순은 없다**. spec `6-config.md` 에 UI 권한 행동을 명기해 두지 않은 것이 문서 gap 이다.
- **제안**: `spec/2-navigation/6-config.md §A.1` 또는 별도 "권한" 소절에 "변경 액션(Add·Toggle·Edit·Regenerate·Delete)은 Admin+ 에게만 노출. Reveal 은 §A.4 별도 규정." 을 추가해 `spec/5-system/1-auth.md §3.2` 와의 대응을 명시한다.

---

## 요약

이번 구현(diff)은 프런트엔드의 Auth Config 변경 액션 버튼(Add Config·Deactivate/Activate 토글·Reveal·Edit·Regenerate·Delete) 전체를 `{isAdmin && ...}` 으로 일괄 가드한 변경이다. `spec/5-system/1-auth.md §3.2` RBAC 매트릭스("Auth Config | Owner=CRUD | Admin=CRUD | Editor=R | Viewer=R")와 백엔드 `@Roles('admin')` 가드와의 일관성은 완전히 확보되어 있다. 데이터 모델 충돌·API 계약 충돌·상태 전이 충돌·요구사항 ID 충돌은 없다. 발견된 사항은 모두 INFO 수준으로, `spec/2-navigation/6-config.md §3 API` 표와 §A.1 화면 구조 설명에 Admin+ 권한 명기가 누락되어 있어 spec 열람자의 오독 가능성만 있을 뿐 구현·다른 spec 영역과의 기능 모순은 없다.

---

## 위험도

LOW
