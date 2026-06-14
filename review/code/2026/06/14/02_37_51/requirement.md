# 요구사항(Requirement) 리뷰 — impl-user-profile-gaps

## 발견사항

### **[WARNING]** `UserProfileDto.theme` Swagger enum 에 `'system'` 누락
- **위치**: `/codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` L21
- **상세**: `UpdateMeDto`의 `USER_THEMES`는 `['light', 'dark', 'system']`로 확장됐으나, 응답 DTO인 `UserProfileDto`의 `theme` 필드 `@ApiProperty` 데코레이터 enum은 여전히 `['light', 'dark']`만 열거한다:
  ```ts
  @ApiProperty({ enum: ['light', 'dark'], example: 'light' })
  theme: string;
  ```
  백엔드가 DB에 `'system'`을 저장하고 반환할 수 있음에도 OpenAPI 스펙이 이 값을 누락하므로, Swagger 문서·클라이언트 코드 생성 결과가 `'system'` 수용 여부를 잘못 기술한다. 기능 완전성(저장·반환)에는 영향 없으나 계약 표현의 불일치다.
  - spec §2.1 테마 필드 설명: "backend `UpdateMeDto.USER_THEMES` 가 `['light','dark','system']` 수용(저장·반환)"
- **제안**: `user-response.dto.ts` L21을 `@ApiProperty({ enum: ['light', 'dark', 'system'], example: 'light' })` 로 수정한다. `USER_THEMES` 상수를 import해 직접 참조하면 향후 enum 변경 시 동기화 누락을 방지할 수 있다.

---

### **[INFO]** 컨트롤러 통합 테스트에 `theme='system'` 케이스 없음
- **위치**: `/codebase/backend/src/modules/users/users.controller.spec.ts` — `updateMe` describe 블록
- **상세**: `update-me.dto.spec.ts`에서 DTO 레벨 검증은 `'system'`을 포함해 테스트하지만, 컨트롤러 통합 테스트에서 `theme: 'dark'`만 사용하고 `theme: 'system'`으로 업데이트·조회하는 경로가 없다. 기능적으로 문제는 없으나 회귀 방어 커버리지가 낮다.
- **제안**: 필수는 아니나 `updateMe` 테스트에 `theme: 'system'` 케이스를 추가하면 좋다.

---

### **[INFO]** `plan/in-progress/spec-sync-user-profile-gaps.md` 테마 항목 완료 표시 — frontend 잔여 명시
- **위치**: `plan/in-progress/spec-sync-user-profile-gaps.md` — `[x] 테마 System` 항목
- **상세**: 항목을 `[x]`로 체크하면서 "**frontend 잔여**" 를 인라인 텍스트로 명시했다. 이는 사실 관계를 정확히 기술하나, frontend 잔여(`prefers-color-scheme` 적용 + UI 토글 노출)가 별도 plan 항목으로 추적되지 않는다. 현재 worktree 범위 밖이므로 별도 PR 기록이 충분하면 INFO.
- **제안**: frontend 작업을 별도 plan 항목 또는 별도 PR에 추적하거나, 항목 설명에 이미 서술된 "(별도 frontend PR)" 메모로 충분히 처리 가능하다 — 현재 기술 방식으로도 추적 가능.

---

### **[INFO]** spec §2.1 테마 행 갱신 — SPEC-DRIFT 아님(의도적 갱신 확인)
- **위치**: `spec/2-navigation/9-user-profile.md` L278 (diff)
- **상세**: spec 본문의 테마 행이 `"UpdateMeDto.USER_THEMES 가 ['light','dark','system'] 수용(저장·반환). system = OS 색상 모드 자동 추종으로 frontend 가 prefers-color-scheme 로 적용(frontend UI 토글 노출은 Planned)"` 으로 갱신됐다. 코드 변경과 spec 변경이 동일 PR에 포함돼 있고 내용이 일치한다. Spec fidelity 문제 없음.

---

## 요약

이번 변경의 핵심 기능(backend `USER_THEMES`에 `'system'` 추가, DTO 검증, spec 본문 갱신, plan 항목 완료 표시)은 spec §2.0/§2.1의 요구사항을 적절히 구현했다. 검증 테스트(`update-me.dto.spec.ts`)도 `light`/`dark`/`system` 세 값과 유효하지 않은 값, 미지정 케이스를 모두 커버하고 있다. 다만 **응답 DTO `UserProfileDto.theme`의 Swagger enum이 `'system'`을 포함하지 않아 OpenAPI 계약 표현이 불완전**하며, 이는 실제 동작(DB 저장·반환)과 API 문서 간의 불일치를 유발한다. 이 외에 미완성 주석·엣지 케이스 처리 누락은 없고 비즈니스 로직(backend는 저장·반환만, frontend가 `prefers-color-scheme` 적용)도 명확하게 분리돼 있다. Frontend 잔여 작업(UI 토글 노출)은 계획 항목에 명시됐고 backend 범위 외임이 명확히 기술됐다.

## 위험도

LOW

---

관련 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/impl-user-profile-gaps-f00493/codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` (L21 — enum 수정 필요)
- `/Volumes/project/private/clemvion/.claude/worktrees/impl-user-profile-gaps-f00493/codebase/backend/src/modules/users/dto/update-me.dto.ts` (변경 정상)
- `/Volumes/project/private/clemvion/.claude/worktrees/impl-user-profile-gaps-f00493/codebase/backend/src/modules/users/dto/update-me.dto.spec.ts` (변경 정상)
- `/Volumes/project/private/clemvion/.claude/worktrees/impl-user-profile-gaps-f00493/spec/2-navigation/9-user-profile.md` (변경 정상)
- `/Volumes/project/private/clemvion/.claude/worktrees/impl-user-profile-gaps-f00493/plan/in-progress/spec-sync-user-profile-gaps.md` (변경 정상)
