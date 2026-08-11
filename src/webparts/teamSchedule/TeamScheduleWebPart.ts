import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IPropertyPaneConfiguration, PropertyPaneTextField } from '@microsoft/sp-property-pane';
import TeamSchedule from './components/TeamSchedule';

export interface ITeamScheduleWebPartProps {
  description: string;
}

export default class TeamScheduleWebPart extends BaseClientSideWebPart<ITeamScheduleWebPartProps> {

  public render(): void {
    const element: React.ReactElement = React.createElement(TeamSchedule, {
      context: this.context,
    });
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: '팀 일정관리 설정' },
          groups: [
            {
              groupName: '기본 설정',
              groupFields: [
                PropertyPaneTextField('description', {
                  label: '설명',
                }),
              ],
            },
          ],
        },
      ],
    };
  }
}
