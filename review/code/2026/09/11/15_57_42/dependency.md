# 의존성(Dependency) 리뷰 — impl-chat-channel-binder (재검토, 15_57_42)

## 검토 범위

이번 라운드는 직전 라운드(`review/code/2026/09/11/15_31_54`)의 후속(`6dc2b7d60`)이다. 실제 코드
변경은 3개뿐이고 나머지(파일 4~30)는 `plan/**`·`review/**` 산출물 커밋으로 의존성 관점의 대상이
아니다:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (신규, 185줄) — 이동된
  6개 함수에 대한 전용 단위 테스트
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (직전 라운드에서 이미 검토됨,
  이번 라운드는 diff 없음 — `git show 6dc2b7d60 --stat` 에 이 파일이 나타나지 않아 확인)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (동일 — 이번 커밋에 diff 없음)

`git show 6dc2b7d60 --stat` 로 확인한 실제 변경 파일 목록에 `package.json`·`pnpm-lock.yaml` 은
없다. `git log --oneline` 상 `2ae81077c`(이전 라운드가 검토한 이동 커밋)와 `6dc2b7d60`(이번
커밋) 어느 쪽에도 매니페스트/락파일 변경이 없음을 직접 확인했다.

## 발견사항

- **[INFO] 새 외부 의존성 없음 — 테스트 파일도 기존 모듈만 import**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:1-13` (import 블록)
  - 상세: 신규 테스트 파일이 import 하는 대상은 `@nestjs/common`(기존), `./chat-channel-input-rules`
    (직전 라운드에서 검토된 순수 함수 모듈), `./chat-channel-rejection-messages.const`,
    `./dto/chat-channel-config.dto`(타입 전용), `./entities/trigger.entity`(타입 전용) — 전부 같은
    패키지(`triggers/`) 내부 모듈이다. 신규 npm 패키지·devDependency 추가 없음.
  - 제안: 없음(문제 아님, 확인 기록).

- **[INFO] 내부 의존 방향 재확인 — 테스트가 `TriggersService` 를 우회해 직접 함수 호출**
  - 위치: `chat-channel-input-rules.spec.ts` 전체 (docstring: "의존이 0이라 mock 없이 직접 호출한다")
  - 상세: 이 테스트는 `Test.createTestingModule` 을 세우지 않고 `chat-channel-input-rules.ts` 의
    export 함수를 직접 호출한다. 이는 T1 계층(외부 협력자 의존 0)이라는 직전 라운드의 판정과
    일치하며, 새로운 내부 의존 관계(예: 테스트가 `TriggersService` 나 `chat-channel/` 하위 모듈을
    끌어옴)를 만들지 않는다. `assertPatchCarriesNoSecrets` 가 이 테스트에서 직접 import 되어
    호출됨으로써 직전 라운드 architecture reviewer 의 INFO(외부 소비자 없이 export 된 표면이
    불필요하게 넓다)에 대한 정당화 근거가 하나 늘었다 — export 표면을 줄이는 방향의 후속 조치가
    있다면 이 테스트가 그 소비자가 됨을 참고해야 한다(의존성 관점에서는 문제가 아니라 참고 사항).
  - 제안: 없음.

- **[INFO] 버전 고정·라이선스·취약점·번들 크기 — 해당 사항 없음**
  - 위치: 이번 커밋(`6dc2b7d60`) 전체
  - 상세: 새 외부 패키지가 없으므로 버전 pinning, 라이선스 호환성, 알려진 CVE, 번들 크기/빌드
    시간 영향 어느 관점에서도 검토할 대상이 없다. 신규 테스트 파일 185줄은 jest 실행 시간에
    미미하게(테스트 12케이스) 기여할 뿐 런타임 번들에는 포함되지 않는다.
  - 제안: 없음.

## 요약

이번 라운드(`6dc2b7d60`)는 직전 라운드에서 지적된 "거짓 등재 주장"을 정정하는 plan/트래커 문서
갱신과, 이동된 chat-channel 입력 규칙 6개 함수에 대한 전용 단위 테스트(`chat-channel-input-rules.spec.ts`,
12케이스)를 추가한 것이 전부다. `package.json`/lockfile 변경은 이번 커밋에도, 그 직전 이동
커밋(`2ae81077c`)에도 없으며, 신규 테스트 파일이 import 하는 5개 대상 전부 기존 내부 모듈(타입
포함)이다. 직전 라운드 dependency reviewer 의 결론(새 의존성 없음·순환 없음·번들 영향 없음)이
이번 라운드에도 그대로 유지되며, 새로 도입된 의존성 관점의 리스크는 없다.

## 위험도
NONE
