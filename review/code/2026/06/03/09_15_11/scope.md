# 변경 범위(Scope) 리뷰

## 발견사항

발견된 범위 이탈 없음.

모든 변경 파일이 `plan/in-progress/channel-web-chat-demo.md`의 작업 항목과 1:1 대응한다:

| 변경 파일 | 대응 plan 항목 |
|---|---|
| `codebase/channel-web-chat/package.json` | (1) dev 포트 분리 |
| `codebase/channel-web-chat/.env.example` | (1) `.env.example` 추가 |
| `codebase/channel-web-chat/.gitignore` | (1) `.gitignore` 수정 |
| `codebase/channel-web-chat/src/app/demo/demo-config.test.ts` | (3) TDD |
| `codebase/channel-web-chat/src/app/demo/demo-config.ts` | (2) 순수 헬퍼 |
| `codebase/channel-web-chat/src/app/demo/demo-host.tsx` | (2) 설정 폼 + iframe |
| `codebase/channel-web-chat/src/app/demo/page.tsx` | (2) 게이팅 + DemoHost |
| `codebase/channel-web-chat/README.md` | (4) DOCUMENTATION |
| `plan/in-progress/channel-web-chat-demo.md` | plan 파일 자체 |
| `review/consistency/2026/06/03/08_56_55/` 하위 | 의무 사전 검토 산출물 |

세부 점검 결과:

- **의도 이상의 변경**: 없음. `channel-web-chat` 외 디렉토리(backend, frontend, packages 등)에 변경 없음.
- **불필요한 리팩토링**: 없음. 기존 위젯 본체 코드(`widget-state`, `host-bridge`, `eia-client` 등) 미접촉. `demo-config.ts` 분리는 "React 비의존 순수 함수 단위테스트 대상"이라는 명시적 설계 의도이며 과도한 추상화 아님.
- **기능 확장**: 없음. `wc:resize` 수신은 forward-compat 로그만(비목표 절에 명시). `show`/`hide`/`updateProfile` 버튼 의도적 미노출(I9 반영).
- **무관한 수정**: 없음. `.gitignore` 변경(`.env*.local` → `.env*` + `!.env.example`)은 `.env.example` 추가와 직결된 필수 보완 수정.
- **포맷팅 변경**: 없음. 실질 변경과 무관한 공백/줄바꿈 변경 불검출.
- **주석 변경**: plan 의도와 무관한 주석 추가 없음. 추가된 주석(I6 `event.source`·origin 검증 언급, I9 `show`/`hide`/`updateProfile` 미노출 사유 등)은 consistency-check 지시사항(I6, I9) 이행 기록으로 적절.
- **임포트 변경**: 없음. 신규 파일의 임포트(`demo-config`, `host-bridge`) 모두 사용됨.
- **설정 변경**: `package.json` `dev` 스크립트 변경은 plan 항목 (1)의 핵심이며, 다른 스크립트(`build`, `lint`, `typecheck`, `test`) 및 `dependencies`/`devDependencies` 미변경.

## 요약

변경 범위가 `plan/in-progress/channel-web-chat-demo.md`에 명시된 작업 항목(dev 포트 분리, `.env.example` 추가, `.gitignore` 수정, TDD 테스트, 데모 Config·Host·Page 구현, README 문서화)에 정확히 한정되어 있다. 위젯 본체 코드, backend, frontend, packages 등 무관 디렉토리에 대한 변경이 전혀 없으며, consistency-check 산출물은 프로세스 의무 이행 결과로 정상 포함이다. 불필요한 리팩토링, 포맷팅 변경, 의도 외 임포트 조정이 발견되지 않았다.

## 위험도

NONE
