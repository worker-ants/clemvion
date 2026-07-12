# Requirement Review — disclaimer 문구 해요체 통일 (3파일)

## 대상
- `codebase/channel-web-chat/src/app/demo/demo-config.ts` (`defaultDemoForm.disclaimer`)
- `codebase/packages/web-chat-sdk/examples/snippet.html` (SDK 스니펫 예제 `disclaimer`)
- `spec/7-channel-web-chat/2-sdk.md` (§1 boot 예시 `disclaimer`)

세 파일 모두 문자열 리터럴 하나(`disclaimer` 필드 값)만 교체하는 순수 카피 변경이며, 로직·시그니처·타입은 전혀
건드리지 않는다. 커밋 메시지(`40a375972`)는 "consistency-check 가 발견한 사전 결함"을
`i18n-userguide §P6` 위반 교정으로 명시한다.

## 검증 내역

1. **byte-level 일치 확인**: 변경 후 세 파일의 disclaimer 문자열을 `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.mdx:50`
   (커밋 메시지가 "canonical" 이라 주장하는 소스)과 md5 비교 — 4개 파일 전부 동일 해시
   (`667a533442ef3f5ed788d8282b4a1035`, `"AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."`). "canonical
   문구로 통일" 주장이 정확함을 실측 확인.
2. **비즈니스 규칙 대조**: `spec/conventions/i18n-userguide.md:50-51, 165-173, 248-249` — Principle 6 은 "해요체로
   통일 (`~합니다`, `~한다` 금지)" 이며 "위젯의 인라인 한국어도 P6 를 따른다"(dict indirection 은 면제되지만 문체는
   공유)고 명시. 변경 전 문구("…정확하지 않을 수 있습니다.", "…추가 확인이 필요합니다.")는 `~습니다` 체로 P6
   위반이었고, 변경 후 "…부정확할 수 있어요." 는 해요체로 규칙에 부합.
3. **필드 배선 확인**: `disclaimer` 는 `BootMessage`/`BootConfig` 의 선택 필드(`host-bridge.ts:15`,
   `spec/7-channel-web-chat/2-sdk.md` §4 스키마)로 실제 렌더 경로(`panel.tsx:194`
   `{config.disclaimer && <footer>...}`)까지 연결돼 있어 이번 문구 변경이 죽은 값이 아니라 실제 노출되는 텍스트임을
   확인.
4. **spec fidelity**: `spec/7-channel-web-chat/2-sdk.md` §1 예시는 `code:` frontmatter 로
   `codebase/packages/web-chat-sdk/**` 를 가리키는 정식 예시 블록 — 이전엔 `'AI는 한정된 데이터로 동작하며 …'` 로
   말줄임 처리돼 실제 SDK 예제(`snippet.html`)의 전체 문구와 문자 그대로 불일치했다(직전 consistency-check
   `review/consistency/2026/07/12/01_41_42/convention_compliance.md` 가 이 drift 를 지적). 본 변경으로 spec
   예시·SDK 예제·데모 기본값·MDX 문서 4곳이 문자 단위로 수렴 — spec-fidelity 개선.
5. **다른 잔존 지점 스캔**: `grep -rn "한정된 데이터로 동작\|정확하지 않을 수 있습니다\|추가 확인이 필요합니다"` 로
   저장소 전체(spec/, codebase/) 를 스캔해 diff 범위 밖에 구 문구가 더 남아있는지 확인. 유일한 잔존은
   `codebase/channel-web-chat/src/widget/widget-app.test.tsx:44,53` — 렌더링 검증용 임의 테스트 픽스처
   (`"AI는 한정된 데이터로 동작합니다."`)로, canonical 예시/기본값이 아니라 독립적인 테스트 데이터이며 diff 대상
   파일도 아님. 기능적 결함이 아니고 이번 변경의 의무 범위도 아니므로 INFO 로만 기록.
6. **엣지 케이스/에러 시나리오/반환값**: 해당 없음 — 조건 분기·검증·에러 처리 로직이 없는 정적 문자열 리터럴
   교체이므로 이 관점들은 영향받지 않는다.
7. **TODO/FIXME**: diff 내 없음.

## 발견사항

- **[INFO]** 인접 테스트 픽스처가 구 문체(합니다체) 잔존 — 이번 diff 범위 밖
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx:44,53`
  - 상세: `disclaimer: "AI는 한정된 데이터로 동작합니다."` 는 렌더링 여부만 검증하는 임의 fixture 값이라 canonical
    문구와 동기화 의무가 없고, `channel-web-chat` 은 frontend hardcoded-korean 가드/doc-sync-matrix 스캔 범위 밖
    (별도 프로젝트 결정 사항)이라 기능적 문제는 아니다. 본 diff 가 손대지 않은 파일이므로 이번 커밋의 결함으로
    카운트하지 않음.
  - 제안: 강제 아님. 후속에 해요체로 맞추면 grep 기반 tone drift 재발 방지에 도움되는 정도.

## 요약
3개 파일(데모 기본값·SDK 예제 스니펫·spec §1 예시)의 `disclaimer` 문구를 `i18n-userguide.md` Principle 6(해요체
통일) 에 맞춰 canonical 문구(`web-chat-sdk.mdx` 와 byte-identical)로 정렬하는 순수 카피 수정이다. 로직 변경이
없어 기능 완전성·엣지 케이스·에러 시나리오·반환값 관점은 해당 없음(N/A)으로 처리했고, 비즈니스 규칙(P6)·spec
fidelity(§1 예시의 기존 말줄임 truncation 이 실제 예제와 어긋나던 drift) 모두 이번 변경으로 개선됐음을 실측
확인했다. 저장소 전수 grep 으로 diff 범위 밖 잔존 구 문구는 out-of-scope 테스트 fixture 1건뿐임을 확인했고 이는
INFO 로 기록했다. CRITICAL/WARNING 없음.

## 위험도
NONE
