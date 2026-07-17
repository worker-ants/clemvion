# Cross-Spec 일관성 검토 — 프론트엔드 레이어 경계 규약 draft

- 검토 모드: spec draft 검토 (--spec)
- target: `plan/in-progress/spec-draft-frontend-layering.md` (신설 예정 `spec/conventions/frontend-layering.md` 의 draft)
- 비교 대상: `spec/0-overview.md`, `spec/1-data-model.md` (payload 동봉) + 저장소 실측(`spec/conventions/**`, `spec/7-channel-web-chat/0-architecture.md` 등)

## 발견사항

없음. 검토한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에서 기존 `spec/**` 과의 충돌을 찾지 못했다. 근거는 아래와 같다.

- **데이터 모델 / API 계약 / 상태 전이 / RBAC** — target 은 이 4개 영역에 해당하는 정의를 전혀 포함하지 않는다(엔티티·엔드포인트·상태값·권한 어휘 0건). `spec/1-data-model.md` 의 어떤 엔티티·필드와도 이름이 겹치지 않아 비교 대상 자체가 없다.
- **요구사항 ID** — target 은 `NAV-*`/`ED-*`/`ND-*` 류 요구사항 ID 를 신규 부여하지 않는다(순수 코드 컨벤션 문서). ID 충돌 가능성 없음.
- **계층 책임 충돌** — target 이 정의하는 `types < lib < components < app` 순서는 `codebase/frontend` 내부의 **import 방향**(모듈 경계)에 관한 것이다. 저장소 내 유일하게 비교 가능한 "레이어 분리" spec 은 `spec/7-channel-web-chat/0-architecture.md §1`(호스트 페이지 → SDK loader → iframe 위젯 SPA → Clemvion API 4-레이어)인데, 이는 **다른 코드베이스 영역**(`codebase/channel-web-chat` / `codebase/packages/web-chat-sdk`)의 **네트워크·배포 경계**를 다루며 `codebase/frontend` 내부 파일 import 방향과는 층위·대상이 완전히 다르다. 두 문서가 같은 "레이어" 용어를 쓰지만 지시 대상이 겹치지 않아 모순이 아니다.
- **naming/문서 위치** — `spec/conventions/` 를 전수 확인한 결과 `frontend-layering.md` 또는 유사 이름의 기존 파일 없음(신설 충돌 없음). `spec/0-overview.md §8 문서 맵`은 "정식 규약 → `spec/conventions/`" 항목을 이미 "구체 파일 목록은 본 문서가 박제하지 않는다"고 명시하므로, 신규 conventions 파일 추가 시 `0-overview.md` 를 함께 갱신할 의무가 없다 — target 의 "산출물" 절(신설 파일 1건만 명시)과 정합.
- **ESLint 관련 기존 규약 중복** — `spec/` 전체에서 `ESLint` 언급은 `spec/conventions/i18n-userguide.md` 1건(무관한 i18n ratchet 규칙)뿐이라 규약 중복 없음.
- **실측 근거 신뢰성(참고, cross-spec 범위 밖)** — target 이 인용하는 "main `099f63cc`" 커밋은 실제 로그에 존재(`099f63cca fix(frontend): ... fail-open 경로 차단 (#969)`)하고, 선행 배경 PR `#967`("src/lib → @/components 레이어 역전을 ESLint 로 차단")도 로그에 확인된다. 이 부분은 spec-impl 일치성 검토 범주라 본 cross-spec 리포트의 판정에는 반영하지 않았으나, 참고용으로 기록한다.

## 요약

target 은 `codebase/frontend` 내부 모듈(`src/types`/`src/lib`/`src/components`/`src/app`) 간 import 방향을 규정하는 순수 코드 컨벤션 문서 신설 draft로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 영역과도 정의를 공유하지 않아 직접 충돌 대상이 없다. 유일하게 같은 "레이어" 용어를 쓰는 `spec/7-channel-web-chat/0-architecture.md` 는 별개 코드베이스(`codebase/channel-web-chat`)의 네트워크/배포 경계를 다루므로 대상이 겹치지 않는다. `spec/conventions/` 네임스페이스에도 이름 충돌이 없고, `0-overview.md` 의 문서 맵 갱신 의무도 없어 target 그대로 반영 가능하다.

## 위험도

NONE
